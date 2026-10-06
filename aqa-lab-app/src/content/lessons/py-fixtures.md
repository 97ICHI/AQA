:::why
Тестам нужна подготовка: новая корзина, клиент API, вошедший пользователь, временный файл. Если готовить всё внутри каждого теста, код повторяется, а если в одном общем месте без правил — тесты начинают зависеть друг от друга. Fixtures pytest дают подготовку с именем, а параметризация — один тест для многих наборов данных.
:::

## Fixture

[[pytest-fixture|Fixture]] — функция с декоратором `@pytest.fixture`. Тест получает её результат, просто указав имя fixture в параметрах:

```py tests/test_cart.py
import pytest
from shop import Cart


@pytest.fixture
def cart():
    return Cart()          # новая корзина для каждого теста


def test_new_cart_is_empty(cart):
    assert cart.count() == 0


def test_add_item(cart):
    cart.add("NOTE-A5", 390, 2)
    assert cart.total() == 780
```

pytest видит параметр `cart`, находит fixture с таким именем, вызывает её и передаёт результат в тест. По умолчанию fixture вызывается **заново для каждого теста** — поэтому `test_add_item` не испортит корзину для `test_new_cart_is_empty`, в каком бы порядке они ни выполнялись. Это и есть [[test-isolation|изоляция тестов]].

### Подготовка и очистка: yield

Если после теста нужно убрать за собой, вместо `return` пишут `yield`. Код до `yield` — подготовка, после — очистка; она выполнится, даже если тест упал:

```py tests/conftest.py
@pytest.fixture
def order_in_db(db):
    order_id = db.insert_order(user_id=1, status="new")
    yield order_id                       # значение для теста
    db.delete_order(order_id)            # очистка после теста
```

### Fixture из fixture и conftest.py

Fixture может запрашивать другие fixtures — так строится цепочка: `api` → `logged_in_api` → `order`. Общие fixtures кладут в файл `conftest.py`: pytest подхватывает его автоматически для всех тестов в папке, импортировать ничего не нужно.

`scope` задаёт, как часто fixture создаётся: `function` (по умолчанию, для каждого теста), `module`, `session` (один раз на весь прогон — для дорогих ресурсов вроде подключения к базе). Чем шире scope, тем внимательнее нужно следить, чтобы тесты не меняли общее состояние.

## Параметризация

[[pytest-parametrize|Параметризация]] запускает одну тестовую функцию для разных данных. Каждый набор — отдельный тест с собственным именем в отчёте:

```py tests/test_cart.py
@pytest.mark.parametrize("qty, total", [
    (1, 390),
    (2, 780),
    (5, 1950),
])
def test_total_counts_qty(cart, qty, total):
    cart.add("NOTE-A5", 390, qty)
    assert cart.total() == total
```

В отчёте будут `test_total_counts_qty[1-390]`, `[2-780]`, `[5-1950]`. Если падает только `[2-780]`, сразу видно, на каких данных. Это [[data-driven-testing|тестирование, управляемое данными]]: логика одна, а наборы данных легко дополнять. Fixtures и параметры свободно сочетаются: здесь тест получает и свежую корзину, и значения из таблицы.

Для понятных имён наборов используют `pytest.param(..., id="two-items")` или аргумент `ids=[...]`. Кириллицу в `id` pytest по умолчанию экранирует (`\u0434…`), поэтому имена наборов обычно пишут латиницей.

:::try Запустите fixture и параметры
Код записывает модуль и тесты во временную папку и запускает pytest с флагом `-v`, чтобы видеть имя каждого теста. Добавьте в таблицу параметров неверный набор, например `(3, 1000)`, и посмотрите, как выглядит падение одного варианта.
:::

```widget
{"type":"playground","lang":"py","title":"fixture + parametrize","code":"import os, sys, tempfile, pytest\n\nSHOP = '''\nclass Cart:\n    def __init__(self):\n        self.items = {}\n    def add(self, sku, price, qty=1):\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        item = self.items.setdefault(sku, {\"price\": price, \"qty\": 0})\n        item[\"qty\"] += qty\n    def total(self):\n        return sum(i[\"price\"] * i[\"qty\"] for i in self.items.values())\n'''\n\nTESTS = '''\nimport pytest\nfrom shop import Cart\n\n@pytest.fixture\ndef cart():\n    print(\"  [fixture] новая корзина\")\n    return Cart()\n\n@pytest.mark.parametrize(\"qty, total\", [(1, 390), (2, 780), (5, 1950)])\ndef test_total(cart, qty, total):\n    cart.add(\"NOTE-A5\", 390, qty)\n    assert cart.total() == total\n\n@pytest.mark.parametrize(\"bad\", [0, -1], ids=[\"zero\", \"negative\"])\ndef test_bad_qty(cart, bad):\n    with pytest.raises(ValueError):\n        cart.add(\"NOTE-A5\", 390, bad)\n'''\n\nd = tempfile.mkdtemp()\nfor name, text in ((\"shop.py\", SHOP), (\"test_cart.py\", TESTS)):\n    with open(os.path.join(d, name), \"w\", encoding=\"utf-8\") as f:\n        f.write(text)\nfor mod in (\"shop\", \"test_cart\"):\n    sys.modules.pop(mod, None)\npytest.main([\"-v\", \"-s\", \"-p\", \"no:cacheprovider\", \"--color=no\", d])\nfor mod in (\"shop\", \"test_cart\"):  # убрать учебные модули из кеша импорта\n    sys.modules.pop(mod, None)\n"}
```

:::happened
Пять тестов из двух функций: три варианта суммы и два недопустимых количества с именами `zero` и `negative`. Флаг `-s` показывает вывод `print`: строка «новая корзина» напечатана перед **каждым** тестом — fixture с областью `function` создаёт объект заново. Если добавить неверный набор, упадёт только он, а в отчёте будет видно его имя с параметрами.
:::

## Задание

```widget
{"type":"exercise","id":"py-test-cart-fixture"}
```

:::deep Встроенные fixtures
pytest предоставляет готовые fixtures: `tmp_path` — временная папка для теста, `monkeypatch` — временная подмена атрибутов, переменных окружения и словарей с автоматическим откатом, `capsys` — перехват вывода, `request` — информация о текущем тесте (например, параметр fixture). В Playwright для Python fixtures `page`, `context`, `browser` устроены так же: тест просит их по имени.
:::

:::tech autouse и порядок
`@pytest.fixture(autouse=True)` применяется ко всем тестам в области видимости без явного запроса — удобно для общей очистки, но делает зависимости неявными; используйте экономно. Порядок подготовки определяется графом зависимостей fixtures и их scope, а очистка выполняется в обратном порядке. Посмотреть, какие fixtures использует тест: `pytest --fixtures-per-test`.
:::

:::interview
**Вопрос:** «Что такое fixture в pytest и чем она лучше setup-метода?» **Ответ по сути:** это именованная функция подготовки, которую тест запрашивает параметром. Она может зависеть от других fixtures, иметь scope (function/module/session) и выполнять очистку после `yield`. В отличие от общего setup, тест получает только то, что явно запросил, а fixtures переиспользуются через `conftest.py`.
:::

:::terms
[[pytest-fixture|fixture pytest]], [[pytest-parametrize|parametrize]], [[test-isolation|изоляция тестов]], [[data-driven-testing|тестирование, управляемое данными]], [[setup-teardown|setup/teardown]], [[fixture-scope|scope fixture]]
:::
