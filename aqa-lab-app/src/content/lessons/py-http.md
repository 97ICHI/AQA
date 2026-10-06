:::why
Большая часть Python-AQA — это API-тесты: отправить запрос, проверить код ответа, тело и побочный эффект. Форма такого теста одинакова для любого HTTP-клиента. Освоив её, вы сможете писать тесты на `requests` или `httpx` в реальном проекте, а здесь отработаете её на учебном клиенте без сети.
:::

## Как выглядит API-тест на Python

В реальных проектах чаще всего используют библиотеку `requests` (или `httpx`). Вот типичный тест учебного магазина:

:::warn Только пример — в тренажёре не запускается
В браузерном Python нет пакета `requests` и нет сети. Код ниже — образец для вашего проекта; ниже в уроке тот же тест выполняется на учебном клиенте.
:::

```py tests/test_orders_api.py
import pytest
import requests

BASE_URL = "http://127.0.0.1:3000"     # адрес стенда — из переменной окружения в реальном проекте


@pytest.fixture
def session():
    s = requests.Session()             # хранит cookies между запросами
    yield s
    s.close()


@pytest.fixture
def logged_in(session):
    res = session.post(f"{BASE_URL}/api/login",
                       json={"email": "anna@example.test", "password": "learn-123"}, timeout=5)
    assert res.status_code == 200
    return session


def test_create_order(logged_in):
    logged_in.post(f"{BASE_URL}/api/cart", json={"productId": 3, "qty": 2}, timeout=5)
    res = logged_in.post(f"{BASE_URL}/api/orders", timeout=5)

    assert res.status_code == 201
    assert res.headers["Content-Type"].startswith("application/json")
    body = res.json()
    assert body["status"] == "new"
    assert isinstance(body["total"], int) and body["total"] == 780
```

Разберём, из чего он состоит:

1. **Клиент как fixture.** `requests.Session` хранит cookies, поэтому вход выполняется один раз в fixture `logged_in`, и следующие запросы идут от имени пользователя.
2. **Запрос.** `session.post(url, json=...)` сериализует словарь в JSON и ставит заголовок `Content-Type`. `timeout` обязателен: без него зависший сервер подвесит весь прогон.
3. **Код ответа** — точное значение: `201 Created`, а не «что-нибудь успешное».
4. **Заголовки и тело.** `res.json()` разбирает тело; проверяются значения **и типы** полей.
5. **Побочный эффект** — отдельным запросом (`GET /api/orders/{id}`) или в базе.

## Учебный клиент: та же форма без сети

Чтобы отработать форму теста в тренажёре, используем `FakeShopApi` — класс с тем же интерфейсом, что у `requests.Session`: методы `post(path, json=...)` и `get(path)` возвращают объект с `status_code`, `headers` и `json()`. Внутри не сеть, а словари в памяти. Такую замену называют [[fake|fake]]: упрощённая, но работающая реализация.

```py shop.py
class FakeShopApi:
    def post(self, path, json=None): ...   # /api/login, /api/cart, /api/orders
    def get(self, path): ...               # /api/orders/<id>
```

Тест на нём выглядит почти так же, как на `requests`, — меняется только fixture, которая создаёт клиента.

:::try Отправьте запросы учебному API
Запустите сценарий: вход, корзина, заказ, чтение заказа. Затем закомментируйте вход и посмотрите, какой код вернёт оформление заказа.
:::

```widget
{"type":"playground","lang":"py","title":"Учебный API без сети","code":"import json as _json\n\nclass Response:\n    def __init__(self, status_code, data):\n        self.status_code = status_code\n        self.headers = {\"Content-Type\": \"application/json\"}\n        self.text = _json.dumps(data, ensure_ascii=False)\n    def json(self):\n        return _json.loads(self.text)\n\nclass FakeShopApi:\n    prices = {1: 4990, 3: 390}\n    def __init__(self):\n        self.user, self.cart, self.orders = None, {}, {}\n    def post(self, path, json=None):\n        body = json or {}\n        if path == \"/api/login\":\n            ok = body.get(\"password\") == \"learn-123\"\n            self.user = body[\"email\"] if ok else None\n            return Response(200 if ok else 401, {\"email\": self.user})\n        if path == \"/api/cart\":\n            pid = body[\"productId\"]\n            self.cart[pid] = self.cart.get(pid, 0) + body.get(\"qty\", 1)\n            return Response(200, {\"count\": sum(self.cart.values())})\n        if path == \"/api/orders\":\n            if self.user is None:\n                return Response(401, {\"error\": \"login required\"})\n            oid = 101 + len(self.orders)\n            total = sum(self.prices[p] * q for p, q in self.cart.items())\n            self.orders[oid] = {\"id\": oid, \"status\": \"new\", \"total\": total}\n            self.cart = {}\n            return Response(201, self.orders[oid])\n    def get(self, path):\n        oid = int(path.rsplit(\"/\", 1)[1])\n        if oid not in self.orders:\n            return Response(404, {\"error\": \"order not found\"})\n        return Response(200, self.orders[oid])\n\napi = FakeShopApi()\nprint(\"login:\", api.post(\"/api/login\", json={\"email\": \"anna@example.test\", \"password\": \"learn-123\"}).status_code)\nprint(\"cart:\", api.post(\"/api/cart\", json={\"productId\": 3, \"qty\": 2}).json())\nres = api.post(\"/api/orders\")\nprint(\"order:\", res.status_code, res.json())\nprint(\"get:\", api.get(f\"/api/orders/{res.json()['id']}\").json())\nprint(\"get 999:\", api.get(\"/api/orders/999\").status_code)\n"}
```

:::happened
Сценарий прошёл те же шаги, что настоящий тест магазина: вход вернул `200`, корзина — количество, оформление — `201` и тело заказа с `total` 780 числом, чтение по `id` — тот же заказ, несуществующий `id` — `404`. Без входа оформление возвращает `401` — именно эту проверку пропускает тест, если смотреть только на «успешный» сценарий.
:::

## unittest.mock: подменить зависимость

Иногда нужно проверить не API, а **свой код**, который вызывает API: например, функцию, которая создаёт заказ и возвращает его номер. Тогда клиента подменяют [[mock-object|мок-объектом]] из стандартного `unittest.mock` и проверяют, *как* код его вызвал:

```py tests/test_checkout.py
from unittest.mock import Mock


def checkout(client, product_id, qty):
    client.post("/api/cart", json={"productId": product_id, "qty": qty})
    res = client.post("/api/orders")
    if res.status_code != 201:
        raise RuntimeError(f"order failed: {res.status_code}")
    return res.json()["id"]


def test_checkout_returns_order_id():
    client = Mock()
    client.post.return_value.status_code = 201
    client.post.return_value.json.return_value = {"id": 101}

    assert checkout(client, 3, 2) == 101
    client.post.assert_any_call("/api/cart", json={"productId": 3, "qty": 2})
```

Mock принимает любой вызов и записывает его; `return_value` задаёт, что вернуть, а `assert_any_call` / `assert_called_once_with` проверяют аргументы. Это юнит-тест вашей функции, а не API-тест: сервер в нём вообще не участвует.

## Задание

```widget
{"type":"exercise","id":"py-test-api-orders"}
```

:::deep Что ещё проверяют в API-тестах
Схему ответа целиком (JSON Schema через `jsonschema` или модели `pydantic`), заголовки (`Content-Type`, кеширование), негативные сценарии (`400`, `401`, `403`, `404`, `422`) и идемпотентность повторов. Для повторяющихся вызовов пишут свой API-клиент — класс с методами `login()`, `add_to_cart()`, `create_order()`, который скрывает пути и разбор ответов; тесты тогда читаются как сценарий.
:::

:::tech requests в деталях
`requests.get/post` без сессии не хранят cookies между вызовами. `res.raise_for_status()` бросает исключение для 4xx/5xx — удобно во вспомогательном коде, но в тесте лучше явный `assert res.status_code == …` с понятным сообщением. По умолчанию `requests` проверяет TLS-сертификат и не имеет таймаута; `verify=False` в тестах — признак проблемы стенда, а не решение. Альтернатива — `httpx`: тот же API плюс асинхронный клиент и HTTP/2.
:::

:::interview
**Вопрос:** «Что вы проверяете в API-тесте на создание ресурса?» **Ответ по сути:** точный код (`201`), заголовок `Content-Type`, тело: обязательные поля, их типы и значения; что ресурс действительно создан — повторным `GET` по `id` или в базе; негативные варианты — без авторизации (`401`), с неверными данными (`400`/`422`). Клиент и авторизация — в fixtures, таймауты — всегда.
:::

:::terms
[[api-testing|API-тестирование]], [[status-code|код ответа]], [[fake|fake]], [[mock-object|мок-объект]], [[api-client|API-клиент]], [[pytest-fixture|fixture pytest]]
:::
