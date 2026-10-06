import type { Exercise } from './types';

// Модуль 8 «Python для задач AQA». Pyodide (CPython 3.14) + pytest 9, без сторонних пакетов и сети.

const cartGood = `class Cart:
    """Учебная корзина: позиции по артикулу, количество складывается."""

    def __init__(self):
        self.items = {}

    def add(self, sku, price, qty=1):
        if qty <= 0:
            raise ValueError("qty must be positive")
        if sku in self.items:
            self.items[sku]["qty"] += qty
        else:
            self.items[sku] = {"price": price, "qty": qty}

    def count(self):
        return sum(i["qty"] for i in self.items.values())

    def total(self):
        return sum(i["price"] * i["qty"] for i in self.items.values())
`;

const apiGood = `"""Учебный API магазина без сети: интерфейс как у requests (status_code, json())."""
import json as _json

PRODUCTS = {1: {"title": "Наушники Pulse", "price": 4990}, 3: {"title": "Блокнот A5", "price": 390}}
USERS = {"anna@example.test": "learn-123"}


class Response:
    def __init__(self, status_code, data):
        self.status_code = status_code
        self.headers = {"Content-Type": "application/json"}
        self.text = _json.dumps(data, ensure_ascii=False)

    def json(self):
        return _json.loads(self.text)


class FakeShopApi:
    """Хранит состояние в памяти: вход, корзину и заказы одного клиента."""

    def __init__(self):
        self.user = None
        self.cart = {}
        self.orders = {}
        self.next_id = 101

    def post(self, path, json=None):
        body = json or {}
        if path == "/api/login":
            if USERS.get(body.get("email")) == body.get("password"):
                self.user = body["email"]
                return Response(200, {"email": self.user})
            return Response(401, {"error": "wrong email or password"})
        if path == "/api/cart":
            pid = body.get("productId")
            if pid not in PRODUCTS:
                return Response(404, {"error": "product not found"})
            self.cart[pid] = self.cart.get(pid, 0) + body.get("qty", 1)
            return Response(200, {"count": sum(self.cart.values()), "total": self._cart_total()})
        if path == "/api/orders":
            if self.user is None:
                return Response(401, {"error": "login required to order"})
            if not self.cart:
                return Response(422, {"error": "cart is empty"})
            total = self._cart_total()
            order = {
                "id": self.next_id,
                "status": "new",
                "total": total,
                "items": [{"productId": p, "qty": q} for p, q in self.cart.items()],
            }
            self.orders[order["id"]] = order
            self.next_id += 1
            self.cart = {}
            return Response(201, order)
        return Response(404, {"error": "not found"})

    def get(self, path):
        if path.startswith("/api/orders/"):
            if self.user is None:
                return Response(401, {"error": "login required"})
            order_id = int(path.rsplit("/", 1)[1])
            if order_id not in self.orders:
                return Response(404, {"error": "order not found"})
            return Response(200, self.orders[order_id])
        return Response(404, {"error": "not found"})

    def _cart_total(self):
        return sum(PRODUCTS[p]["price"] * q for p, q in self.cart.items())
`;

const ex: Exercise[] = [
  {
    id: 'py-values-product',
    lesson: 'py-values',
    kind: 'py',
    title: 'Переменные товара',
    goal: 'Создайте переменные: `title` — строка `"Блокнот A5"`, `price` — целое число `390`, `qty` — целое `2`, `total` — стоимость `price * qty`, `in_stock` — логическое значение «есть в наличии» (`True`).',
    starter: `title = "Блокнот A5"
price = "390"
qty = 2
total = 0  # TODO: посчитайте из price и qty
in_stock = "да"
`,
    solution: `title = "Блокнот A5"
price = 390
qty = 2
total = price * qty
in_stock = True
`,
    check: `import student


def test_title():
    assert student.title == "Блокнот A5"


def test_price_is_int():
    assert type(student.price) is int, f"price должен быть int, а не {type(student.price).__name__}"
    assert student.price == 390


def test_qty_is_int():
    assert type(student.qty) is int
    assert student.qty == 2


def test_total():
    assert student.total == 780


def test_in_stock_is_bool():
    assert student.in_stock is True, "нужно логическое значение True, а не строка"
`,
    explanation: '`"390"` в кавычках — строка, а не число: `"390" * 2` в Python даёт строку `"390390"`, а не 780. Логическое значение пишется без кавычек и с большой буквы: `True`. `total = price * qty` вычисляется из других переменных — если цена изменится, итог пересчитается при следующем запуске, а не останется подсмотренным числом.',
    hints: [
      'Проверьте типы: число пишется без кавычек, логическое значение — `True` или `False`.',
      'Уберите кавычки у `price`, вместо `"да"` поставьте `True`, а `total` вычислите умножением.',
      '`price = 390`, `total = price * qty`, `in_stock = True`',
    ],
    mistakes: ['`price = "390"` — строка; умножение строки на число повторяет её.', '`in_stock = "True"` — это строка, а не логическое значение; непустая строка всегда «истинна», даже `"False"`.'],
  },
  {
    id: 'py-price-text',
    lesson: 'py-strings-numbers',
    kind: 'py',
    title: 'Цена в тексте страницы',
    goal: 'Напишите `format_rub(amount)` — целое число в строку вида `"4 990 ₽"` (тысячи через пробел), и `parse_price(text)` — обратно в `int`. `parse_price` должна понимать и обычный, и неразрывный пробел (`"\\u00a0"`) и лишние пробелы по краям.',
    starter: `def format_rub(amount):
    return str(amount) + " ₽"


def parse_price(text):
    return int(text.replace(" ₽", ""))
`,
    solution: `def format_rub(amount):
    return f"{amount:,}".replace(",", " ") + " ₽"


def parse_price(text):
    digits = text.replace("₽", "").replace("\\u00a0", "").replace(" ", "")
    return int(digits)
`,
    check: `from student import format_rub, parse_price


def test_format_small():
    assert format_rub(390) == "390 ₽"


def test_format_thousands():
    assert format_rub(4990) == "4 990 ₽"
    assert format_rub(1234567) == "1 234 567 ₽"


def test_parse_simple():
    assert parse_price("390 ₽") == 390


def test_parse_thousands():
    assert parse_price("12 490 ₽") == 12490


def test_parse_nbsp_and_spaces():
    assert parse_price("4\\u00a0990\\u00a0₽") == 4990
    assert parse_price("  7 990 ₽ ") == 7990


def test_parse_returns_int():
    assert type(parse_price("590 ₽")) is int


def test_round_trip():
    for amount in (0, 5, 990, 12490, 100000):
        assert parse_price(format_rub(amount)) == amount
`,
    explanation: 'f-строка с форматом `{amount:,}` разделяет тысячи запятой (`4,990`), остаётся заменить запятую пробелом. В разборе удаляются знак рубля и все виды пробелов, после чего `int()` превращает строку цифр в число. Неразрывный пробел `\\u00a0` часто встречается в ценах на страницах: визуально он не отличается от обычного, но `replace(" ", "")` его не удаляет.',
    hints: [
      'Для форматирования удобна f-строка; для разбора — убрать всё, кроме цифр, и вызвать `int()`.',
      'Формат `{n:,}` ставит запятые между тысячами; `str.replace` меняет одну подстроку на другую — его можно вызывать цепочкой.',
      '`f"{amount:,}".replace(",", " ") + " ₽"` и `text.replace("₽", "").replace("\\u00a0", "").replace(" ", "")`',
    ],
    mistakes: ['Не учесть неразрывный пробел: тест на реальной странице падает с `ValueError: invalid literal for int()`.', 'Возвращать `float` — цены в рублях без копеек удобнее и точнее хранить целыми.'],
    alternatives: ['int("".join(ch for ch in text if ch.isdigit()))'],
  },
  {
    id: 'py-order-dict',
    lesson: 'py-lists-dicts',
    kind: 'py',
    title: 'Заказ как словарь',
    goal: 'В `order` уже описан заказ. Добавьте в `order["items"]` позицию `{"sku": "MUG-01", "price": 690, "qty": 1}`, поменяйте статус на `"shipped"`, сохраните email покупателя в `email`, а список артикулов всех позиций (по порядку) — в `skus`.',
    starter: `order = {
    "id": 101,
    "status": "paid",
    "user": {"id": 1, "email": "anna@example.test"},
    "items": [
        {"sku": "PULSE-01", "price": 4990, "qty": 1},
        {"sku": "NOTE-A5", "price": 390, "qty": 2},
    ],
}

# TODO: добавьте позицию, смените статус
email = ""
skus = []
`,
    solution: `order = {
    "id": 101,
    "status": "paid",
    "user": {"id": 1, "email": "anna@example.test"},
    "items": [
        {"sku": "PULSE-01", "price": 4990, "qty": 1},
        {"sku": "NOTE-A5", "price": 390, "qty": 2},
    ],
}

order["items"].append({"sku": "MUG-01", "price": 690, "qty": 1})
order["status"] = "shipped"
email = order["user"]["email"]
skus = [item["sku"] for item in order["items"]]
`,
    check: `from student import order, email, skus


def test_status_changed():
    assert order["status"] == "shipped"


def test_item_appended_last():
    assert len(order["items"]) == 3
    assert order["items"][-1] == {"sku": "MUG-01", "price": 690, "qty": 1}


def test_old_items_kept():
    assert order["items"][0]["sku"] == "PULSE-01"
    assert order["items"][1] == {"sku": "NOTE-A5", "price": 390, "qty": 2}


def test_email():
    assert email == "anna@example.test"


def test_skus_in_order():
    assert skus == ["PULSE-01", "NOTE-A5", "MUG-01"]
`,
    explanation: '`append` добавляет элемент в конец списка, присваивание по ключу `order["status"] = …` меняет значение в словаре. Вложенные данные читаются цепочкой: `order["user"]["email"]`. Список артикулов строится генератором списка `[item["sku"] for item in order["items"]]`; если он записан **после** `append`, в него попадает и новая позиция.',
    hints: [
      'Список меняется методом, словарь — присваиванием по ключу.',
      '`order["items"].append({...})`; email лежит во вложенном словаре `order["user"]`.',
      '`skus = [item["sku"] for item in order["items"]]` — после добавления позиции.',
    ],
    mistakes: ['Посчитать `skus` до `append` — новая позиция в список не попадёт.', 'Создать новый словарь вместо изменения `order` — старые позиции потеряются.'],
  },
  {
    id: 'py-find-bad-items',
    lesson: 'py-conditions-loops',
    kind: 'py',
    title: 'Найти некорректные позиции',
    goal: 'Напишите `find_bad_items(items)`: вернуть список `sku` (в исходном порядке) тех позиций, у которых `qty <= 0`, или `price < 0`, или нет названия — ключа `"title"` нет или строка пустая.',
    starter: `def find_bad_items(items):
    bad = []
    for item in items:
        if item["qty"] < 0:
            bad.append(item["sku"])
    return bad
`,
    solution: `def find_bad_items(items):
    bad = []
    for item in items:
        if item["qty"] <= 0 or item["price"] < 0 or not item.get("title"):
            bad.append(item["sku"])
    return bad
`,
    check: `from student import find_bad_items

OK = {"sku": "NOTE-A5", "title": "Блокнот A5", "price": 390, "qty": 2}


def test_empty_list():
    assert find_bad_items([]) == []


def test_all_good():
    free = {"sku": "STICK-01", "title": "Наклейки", "price": 0, "qty": 3}
    assert find_bad_items([OK, free]) == []


def test_zero_and_negative_qty():
    items = [{**OK, "sku": "A", "qty": 0}, OK, {**OK, "sku": "B", "qty": -1}]
    assert find_bad_items(items) == ["A", "B"]


def test_negative_price():
    assert find_bad_items([{**OK, "sku": "C", "price": -10}]) == ["C"]


def test_missing_or_empty_title():
    no_title = {"sku": "D", "price": 100, "qty": 1}
    empty = {**OK, "sku": "E", "title": ""}
    assert find_bad_items([no_title, OK, empty]) == ["D", "E"]


def test_several_problems_listed_once():
    assert find_bad_items([{"sku": "F", "title": "", "price": -1, "qty": 0}]) == ["F"]
`,
    explanation: 'Условия соединены через `or`: позиция плохая, если нарушено хотя бы одно правило, и попадает в список один раз. `item.get("title")` возвращает `None`, если ключа нет, а `not` одинаково срабатывает на `None` и на пустую строку. Граница важна: `qty <= 0`, потому что нулевое количество тоже ошибка, а `price < 0` — потому что бесплатный товар (цена 0) допустим.',
    hints: [
      'Сравните условие в стартовом коде с описанием: какие правила не проверены и какая граница неверна?',
      'Соедините три проверки через `or`. Для отсутствующего ключа используйте `item.get("title")` — `item["title"]` упадёт с `KeyError`.',
      '`if item["qty"] <= 0 or item["price"] < 0 or not item.get("title"):`',
    ],
    mistakes: ['`item["title"] == ""` — падает с `KeyError`, если ключа нет.', '`price <= 0` — отбраковывает бесплатные товары, которые допустимы.', 'Три отдельных `if` с `append` — позиция с несколькими проблемами попадёт в список несколько раз.'],
    alternatives: ['[i["sku"] for i in items if i["qty"] <= 0 or i["price"] < 0 or not i.get("title")]'],
  },
  {
    id: 'py-order-total-fn',
    lesson: 'py-functions',
    kind: 'py',
    title: 'Функции расчёта заказа',
    goal: 'Напишите `line_total(item)` — стоимость позиции (`price * qty`) и `order_total(items, discount_percent=0)` — сумму позиций со скидкой в процентах, округлённую до 2 знаков. `order_total` должна использовать `line_total`.',
    starter: `def line_total(item):
    return item["price"]


def order_total(items, discount_percent):
    total = 0
    for item in items:
        total += item["price"]
    return total
`,
    solution: `def line_total(item):
    return item["price"] * item["qty"]


def order_total(items, discount_percent=0):
    total = sum(line_total(item) for item in items)
    return round(total * (100 - discount_percent) / 100, 2)
`,
    check: `from unittest import mock

import student
from student import line_total, order_total

ITEMS = [{"price": 4990, "qty": 1}, {"price": 390, "qty": 2}]


def test_line_total():
    assert line_total({"price": 390, "qty": 2}) == 780


def test_order_total_without_discount():
    assert order_total(ITEMS) == 5770


def test_empty_order():
    assert order_total([]) == 0


def test_discount_keyword():
    assert order_total(ITEMS, discount_percent=10) == 5193


def test_discount_rounded():
    assert order_total([{"price": 333, "qty": 1}], 15) == 283.05


def test_uses_line_total():
    with mock.patch.object(student, "line_total", return_value=1) as fake:
        assert student.order_total(ITEMS) == 2
    assert fake.call_count == 2
`,
    explanation: 'Функция с параметром по умолчанию `discount_percent=0` вызывается и без скидки, и со скидкой по имени аргумента. `order_total` переиспользует `line_total`: правило «цена × количество» записано в одном месте, и если оно изменится, менять придётся одну функцию. Последняя проверка подменяет `line_total` через `unittest.mock` и убеждается, что `order_total` её действительно вызывает. `round(…, 2)` убирает «хвосты» float вроде `0.30000000000000004`.',
    hints: [
      'Сумма позиции учитывает количество, а у второго параметра должно быть значение по умолчанию.',
      'Объявите `def order_total(items, discount_percent=0):` и суммируйте `line_total(item)` по всем позициям; скидка — умножение на `(100 - discount_percent) / 100`.',
      '`return round(sum(line_total(i) for i in items) * (100 - discount_percent) / 100, 2)`',
    ],
    mistakes: ['Без значения по умолчанию вызов `order_total(items)` падает с `TypeError: missing 1 required positional argument`.', 'Повторить `price * qty` внутри `order_total` вместо вызова `line_total` — правило окажется записано дважды.'],
  },
  {
    id: 'py-parse-qty',
    lesson: 'py-exceptions',
    kind: 'py',
    title: 'Ошибка, которую нельзя прятать',
    goal: 'Напишите `parse_qty(raw)`: строка → целое количество (пробелы по краям допустимы). Для нечисловой строки и для значения ≤ 0 — `ValueError`, в сообщении которого есть исходная строка. И `parse_all(raws)`: вернуть кортеж `(хорошие_числа, плохие_строки)`, не падая на плохих.',
    starter: `def parse_qty(raw):
    try:
        return int(raw)
    except:
        return 0


def parse_all(raws):
    return [parse_qty(r) for r in raws], []
`,
    solution: `def parse_qty(raw):
    try:
        qty = int(raw.strip())
    except ValueError:
        raise ValueError(f"bad qty: {raw!r}") from None
    if qty <= 0:
        raise ValueError(f"qty must be positive: {raw!r}")
    return qty


def parse_all(raws):
    good, bad = [], []
    for raw in raws:
        try:
            good.append(parse_qty(raw))
        except ValueError:
            bad.append(raw)
    return good, bad
`,
    check: `import pytest
from student import parse_qty, parse_all


def test_valid():
    assert parse_qty("3") == 3
    assert parse_qty(" 12 ") == 12


@pytest.mark.parametrize("raw", ["abc", "", "1.5", "два"])
def test_not_a_number(raw):
    with pytest.raises(ValueError) as err:
        parse_qty(raw)
    assert raw in str(err.value), "в сообщении об ошибке должна быть исходная строка"


@pytest.mark.parametrize("raw", ["0", "-2"])
def test_not_positive(raw):
    with pytest.raises(ValueError, match=raw):
        parse_qty(raw)


def test_parse_all_splits():
    assert parse_all(["2", "x", "0", " 5 "]) == ([2, 5], ["x", "0"])


def test_parse_all_empty():
    assert parse_all([]) == ([], [])
`,
    explanation: 'Голый `except:` с `return 0` превращает любую проблему — опечатку в данных, `None` вместо строки — в правдоподобный ноль, и тест дальше работает с неверными данными. Правильно ловить только ожидаемый тип (`ValueError`) и либо сообщать понятнее (`raise ValueError(...)` с исходным значением), либо обрабатывать там, где известно, что делать, — как в `parse_all`, которая раскладывает строки на хорошие и плохие. `from None` скрывает техническую цепочку исключений; без него решение тоже верно.',
    hints: [
      'Функция должна сообщать об ошибке, а не возвращать 0. Где ошибку можно *обработать* — в `parse_qty` или в `parse_all`?',
      'В `parse_qty` поймайте только `ValueError` от `int()` и выбросьте новый `ValueError` с `raw` в сообщении; отдельно проверьте `qty <= 0`. В `parse_all` — `try/except ValueError` вокруг каждого вызова.',
      '`raise ValueError(f"bad qty: {raw!r}")` и в цикле: `try: good.append(parse_qty(raw))` / `except ValueError: bad.append(raw)`',
    ],
    mistakes: ['`except:` или `except Exception:` без повторного `raise` — ошибка исчезает, тест получает неверные данные.', 'Вернуть `None` вместо исключения — ошибка «всплывёт» позже и далеко от причины.'],
  },
  {
    id: 'py-order-summary',
    lesson: 'py-json',
    kind: 'py',
    title: 'Сводка заказа из JSON',
    goal: 'Напишите `summarize(text)`: из JSON-ответа заказа вернуть словарь `{"id", "positions", "units", "total", "titles"}` (число позиций, сумма `qty`, сумма `qty * price`, список названий). И `save_summary(summary, path)`: записать сводку в файл как JSON в UTF-8, кириллица — без `\\u`-экранирования.',
    starter: `import json


def summarize(text):
    data = json.loads(text)
    return {"id": data["id"], "positions": 0, "units": 0, "total": 0, "titles": []}


def save_summary(summary, path):
    with open(path, "w") as f:
        f.write(str(summary))
`,
    solution: `import json


def summarize(text):
    data = json.loads(text)
    items = data["items"]
    return {
        "id": data["id"],
        "positions": len(items),
        "units": sum(i["qty"] for i in items),
        "total": sum(i["qty"] * i["price"] for i in items),
        "titles": [i["title"] for i in items],
    }


def save_summary(summary, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
`,
    check: `import json
import pytest
from student import summarize, save_summary

BODY = json.dumps({
    "id": 101, "status": "paid",
    "items": [
        {"title": "Наушники Pulse", "price": 4990, "qty": 1},
        {"title": "Блокнот A5", "price": 390, "qty": 2},
    ],
})


def test_summary_values():
    assert summarize(BODY) == {"id": 101, "positions": 2, "units": 3, "total": 5770,
                               "titles": ["Наушники Pulse", "Блокнот A5"]}


def test_empty_order():
    s = summarize('{"id": 7, "items": []}')
    assert (s["positions"], s["units"], s["total"], s["titles"]) == (0, 0, 0, [])


def test_invalid_json_raises():
    with pytest.raises(ValueError):
        summarize("{not json")


def test_save_is_valid_json(tmp_path):
    path = tmp_path / "summary.json"
    summary = summarize(BODY)
    save_summary(summary, path)
    with open(path, encoding="utf-8") as f:
        assert json.load(f) == summary


def test_save_keeps_cyrillic(tmp_path):
    path = tmp_path / "summary.json"
    save_summary(summarize(BODY), path)
    text = path.read_text(encoding="utf-8")
    assert "Блокнот A5" in text, "кириллица записана как \\\\uXXXX — нужен ensure_ascii=False"
`,
    explanation: '`json.loads` превращает текст в словари и списки Python, дальше это обычная работа со структурами. `json.dump` записывает обратно; по умолчанию он экранирует не-ASCII символы (`\\u0411…`), поэтому для читаемого файла нужен `ensure_ascii=False` и явная кодировка `utf-8` при открытии файла. `str(summary)` — не JSON: у него одинарные кавычки, и `json.load` его не прочитает. Неверный JSON вызывает `json.JSONDecodeError` — это подкласс `ValueError`, его не нужно ловить специально.',
    hints: [
      'После `json.loads` у вас обычный словарь со списком `items` — посчитайте по нему значения.',
      '`len()` — число позиций, `sum(... for i in items)` — суммы; для файла используйте `json.dump`, а не `str()`.',
      '`json.dump(summary, f, ensure_ascii=False, indent=2)` в файле, открытом с `encoding="utf-8"`',
    ],
    mistakes: ['`f.write(str(summary))` — получается текст в синтаксисе Python, а не JSON.', 'Забыть `encoding="utf-8"` — на Windows файл запишется в другой кодировке.'],
  },
  {
    id: 'py-requirements',
    lesson: 'py-venv',
    kind: 'py',
    title: 'Разбор requirements.txt',
    goal: 'Напишите `parse_requirements(text)` → словарь «имя пакета в нижнем регистре → версия» (для `pkg==1.2` версия `"1.2"`, для остальных записей — `None`). Пустые строки и комментарии (`# …`, в том числе в конце строки) пропускаются. И `unpinned(text)` — список имён без точной версии, по алфавиту.',
    starter: `def parse_requirements(text):
    result = {}
    for line in text.splitlines():
        name, version = line.split("==")
        result[name] = version
    return result


def unpinned(text):
    return []
`,
    solution: `def parse_requirements(text):
    result = {}
    for line in text.splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        if "==" in line:
            name, version = line.split("==", 1)
            result[name.strip().lower()] = version.strip()
        else:
            name = line
            for sep in (">=", "<=", "~=", ">", "<", "!="):
                name = name.split(sep, 1)[0]
            result[name.strip().lower()] = None
    return result


def unpinned(text):
    return sorted(name for name, version in parse_requirements(text).items() if version is None)
`,
    check: `from student import parse_requirements, unpinned

TEXT = """
# зависимости тестов
pytest==9.1.1
Requests==2.32.5   # HTTP-клиент

pytest-xdist>=3.6
jsonschema
"""


def test_pinned_versions():
    deps = parse_requirements(TEXT)
    assert deps["pytest"] == "9.1.1"
    assert deps["requests"] == "2.32.5"


def test_unpinned_have_none():
    deps = parse_requirements(TEXT)
    assert deps["pytest-xdist"] is None
    assert deps["jsonschema"] is None


def test_comments_and_blank_lines_skipped():
    assert set(parse_requirements(TEXT)) == {"pytest", "requests", "pytest-xdist", "jsonschema"}


def test_unpinned_sorted():
    assert unpinned(TEXT) == ["jsonschema", "pytest-xdist"]


def test_empty():
    assert parse_requirements("") == {}
    assert unpinned("# только комментарий\\n") == []
`,
    explanation: 'Строка сначала очищается: всё после `#` — комментарий, пробелы по краям убираются, пустые строки пропускаются. Точная версия бывает только у `==`; запись с `>=` или без версии означает «любая подходящая», и на разных машинах установится разное — это и есть «незакреплённая» зависимость, из-за которой тесты в CI ведут себя иначе, чем локально. Имена пакетов в pip нечувствительны к регистру, поэтому ключи приводятся к нижнему.',
    hints: [
      'Стартовый код падает на пустой строке и комментарии: сначала отрежьте всё после `#` и пропустите пустое.',
      'Если в строке есть `==`, разделите по нему; иначе имя — часть до первого оператора сравнения, а версия — `None`.',
      '`line = line.split("#", 1)[0].strip()`; `if not line: continue`; `unpinned` — `sorted(n for n, v in deps.items() if v is None)`',
    ],
    mistakes: ['`line.split("==")` без проверки — `ValueError: not enough values to unpack` на строке без версии.', 'Оставить имя `Requests` с большой буквы — тот же пакет окажется в словаре под двумя ключами.'],
  },
  {
    id: 'py-test-cart-fixture',
    lesson: 'py-fixtures',
    kind: 'py-test',
    title: 'Fixture и параметризация для корзины',
    goal: 'В `shop.py` есть класс `Cart` с методами `add(sku, price, qty=1)`, `count()` и `total()`; `qty <= 0` — `ValueError`, повторное добавление того же `sku` увеличивает количество. Напишите тесты с fixture `cart` и `@pytest.mark.parametrize`, которые проходят на исправной версии и ловят все три дефекта.',
    starter: `import pytest
from shop import Cart


@pytest.fixture
def cart():
    return Cart()


def test_add_one_item(cart):
    cart.add("NOTE-A5", 390)
    assert cart.count() == 1

# TODO: сумма с количеством, повторное добавление, недопустимые qty
`,
    solution: `import pytest
from shop import Cart


@pytest.fixture
def cart():
    return Cart()


def test_new_cart_is_empty(cart):
    assert cart.count() == 0
    assert cart.total() == 0


@pytest.mark.parametrize("qty, total", [(1, 390), (2, 780), (5, 1950)])
def test_total_counts_qty(cart, qty, total):
    cart.add("NOTE-A5", 390, qty)
    assert cart.total() == total


def test_same_sku_adds_up(cart):
    cart.add("NOTE-A5", 390)
    cart.add("NOTE-A5", 390, 2)
    assert cart.count() == 3


@pytest.mark.parametrize("bad_qty", [0, -1])
def test_bad_qty_rejected(cart, bad_qty):
    with pytest.raises(ValueError):
        cart.add("NOTE-A5", 390, bad_qty)
`,
    explanation: 'Fixture `cart` создаёт новую корзину для **каждого** теста, поэтому тесты не зависят друг от друга и от порядка запуска. `parametrize` превращает одну функцию в несколько тестов: в отчёте видно, на каком именно количестве посчиталось неверно. Каждый дефект ловит свой тест: сумма без учёта количества — `test_total_counts_qty` при `qty > 1`, перезапись количества — `test_same_sku_adds_up`, пропуск нуля — `test_bad_qty_rejected[0]`.',
    hints: [
      'Пройдитесь по правилам из описания: для каждого нужен тест, и проверять надо границы (0, повторное добавление, количество больше 1).',
      'Параметры передаются строкой имён и списком кортежей: `@pytest.mark.parametrize("qty, total", [(1, 390), (2, 780)])`; fixture указывается в параметрах теста рядом с ними.',
      '`with pytest.raises(ValueError): cart.add("NOTE-A5", 390, 0)` и `cart.add(...); cart.add(...); assert cart.count() == 3`',
    ],
    good: cartGood,
    broken: [
      { name: 'Сломано: повторное добавление перезаписывает количество', code: cartGood.replace('self.items[sku]["qty"] += qty', 'self.items[sku]["qty"] = qty') },
      { name: 'Сломано: количество 0 принимается', code: cartGood.replace('if qty <= 0:', 'if qty < 0:') },
      { name: 'Сломано: сумма не учитывает количество', code: cartGood.replace('i["price"] * i["qty"]', 'i["price"]') },
    ],
    mistakes: ['Создавать корзину на уровне модуля (`cart = Cart()`) — тесты делят одно состояние и зависят от порядка.', 'Проверять только `qty = 1` — дефект «сумма без количества» на нём не виден.'],
  },
  {
    id: 'py-test-api-orders',
    lesson: 'py-http',
    kind: 'py-test',
    title: 'API-тесты заказа на учебном клиенте',
    goal: 'В `shop.py` есть `FakeShopApi` — учебная замена HTTP-клиента без сети: `post(path, json=...)` и `get(path)` возвращают ответ с `status_code` и `json()`. Напишите тесты: оформление заказа (`201`, `total` — число 780 за 2 × товар `3`), заказ без входа (`401`) и чтение созданного заказа по `id`. Тесты должны поймать все три дефекта.',
    starter: `import pytest
from shop import FakeShopApi


@pytest.fixture
def api():
    return FakeShopApi()


def test_create_order(api):
    api.post("/api/login", json={"email": "anna@example.test", "password": "learn-123"})
    api.post("/api/cart", json={"productId": 3, "qty": 2})
    res = api.post("/api/orders")
    assert res.status_code < 300

# TODO: проверьте тело ответа, заказ без входа и GET /api/orders/<id>
`,
    solution: `import pytest
from shop import FakeShopApi


@pytest.fixture
def api():
    return FakeShopApi()


@pytest.fixture
def logged_in(api):
    res = api.post("/api/login", json={"email": "anna@example.test", "password": "learn-123"})
    assert res.status_code == 200
    return api


def test_create_order(logged_in):
    logged_in.post("/api/cart", json={"productId": 3, "qty": 2})
    res = logged_in.post("/api/orders")
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "new"
    assert isinstance(body["total"], int)
    assert body["total"] == 780


def test_order_requires_login(api):
    api.post("/api/cart", json={"productId": 3, "qty": 1})
    res = api.post("/api/orders")
    assert res.status_code == 401


def test_created_order_can_be_read(logged_in):
    logged_in.post("/api/cart", json={"productId": 1})
    created = logged_in.post("/api/orders").json()
    res = logged_in.get(f"/api/orders/{created['id']}")
    assert res.status_code == 200
    assert res.json()["total"] == created["total"] == 4990
`,
    explanation: 'API-тест проверяет три вещи: код ответа (точно `201`, а не «любой успешный»), тело (поля и их **типы** — `"780"` строкой нарушает контракт, хотя выглядит так же) и побочный эффект — созданный заказ читается по `id`. Fixture `logged_in` строится на fixture `api`: вход выполняется в подготовке, а тест без входа просто берёт `api`. Тот же тест с настоящим `requests.Session` отличался бы только fixture, которая создаёт клиента.',
    hints: [
      '`status_code < 300` пропускает `200` вместо `201`. Какие ещё свойства ответа важны клиенту API?',
      'Проверьте точный код, значение и тип `total` (`isinstance(..., int)`), отдельный тест — без `/api/login`.',
      '`assert res.status_code == 201`, `assert isinstance(body["total"], int)`, а в тесте без входа — `assert api.post("/api/orders").status_code == 401`',
    ],
    good: apiGood,
    broken: [
      { name: 'Сломано: создание заказа отвечает 200 вместо 201', code: apiGood.replace('return Response(201, order)', 'return Response(200, order)') },
      { name: 'Сломано: total приходит строкой', code: apiGood.replace('"total": total,', '"total": str(total),') },
      { name: 'Сломано: заказ оформляется без входа', code: apiGood.replace('            if self.user is None:\n                return Response(401, {"error": "login required to order"})\n', '') },
    ],
    mistakes: ['`assert res.ok` или `status_code < 300` — пропускает неверный код успеха.', 'Сравнивать `str(body["total"]) == "780"` — тип поля не проверяется, дефект «число стало строкой» проходит.'],
  },
];
export default ex;
