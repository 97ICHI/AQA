:::why
До сих пор код проверялся вручную: запустили, посмотрели на вывод. [[pytest]] делает проверки автоматическими: находит тесты, запускает их и показывает, что именно не совпало. Это основной фреймворк Python-AQA — на нём пишут юнит-, API- и UI-тесты (с Playwright для Python).
:::

## Первый тест

Тест в pytest — обычная функция, имя которой начинается с `test_`, в файле `test_*.py`. Проверка — обычный `assert`:

```py tests/test_cart.py
from shop import cart_total


def test_total_counts_quantity():
    assert cart_total([{"price": 390, "qty": 2}]) == 780


def test_empty_cart_is_zero():
    assert cart_total([]) == 0
```

Запуск — из папки проекта:

```bash terminal
python -m pytest            # все тесты
python -m pytest -q         # кратко
python -m pytest tests/test_cart.py::test_empty_cart_is_zero   # один тест
python -m pytest -k promo   # тесты, в имени которых есть «promo»
```

pytest сам находит файлы и функции по именам — регистрировать тесты не нужно. Каждый тест независим: падение одного не останавливает остальные.

## Как читать отчёт

```text
F.                                                                  [100%]
================================= FAILURES =================================
_______________________ test_total_counts_quantity ________________________

    def test_total_counts_quantity():
>       assert cart_total([{"price": 390, "qty": 2}]) == 780
E       assert 390 == 780
E        +  where 390 = cart_total([{'price': 390, 'qty': 2}])

tests/test_cart.py:5: AssertionError
========================= short test summary info ==========================
FAILED tests/test_cart.py::test_total_counts_quantity - assert 390 == 780
1 failed, 1 passed in 0.03s
```

- Строка `F.` — результат каждого теста: `.` прошёл, `F` упал, `E` — ошибка вне проверки (например, в подготовке).
- `>` отмечает строку, где упало.
- `E` — объяснение: что получено (`390`) и откуда оно взялось (`where 390 = cart_total(...)`). pytest переписывает `assert` так, что показывает промежуточные значения — отдельные `assertEqual` не нужны.
- В конце — сводка: что упало и итог.

Читается это так же, как отчёт Playwright: ожидалось 780, получено 390 — сумма не учитывает количество.

## Хороший тест

- **Одна идея — один тест.** Имя теста описывает правило: `test_unknown_promo_is_rejected`, а не `test_promo_3`.
- **Проверяется поведение, а не реализация**: результат функции, а не то, какие внутренние переменные она использовала.
- **Граничные случаи**: пустая корзина, количество больше 1, неизвестный код.
- **Тест должен уметь падать.** Если тест проходит и на исправном, и на сломанном коде, он ничего не проверяет. Именно так устроены задания этого курса: ваши тесты запускаются против исправной и нескольких сломанных версий.

Ожидаемое исключение проверяют через `pytest.raises`, дробные числа — через `pytest.approx`:

```py tests/test_promo.py
import pytest
from shop import apply_promo


def test_unknown_promo_is_rejected():
    with pytest.raises(ValueError):
        apply_promo(1000, "FREE")


def test_spring_discount():
    assert apply_promo(999.99, "SPRING") == pytest.approx(899.99, abs=0.01)
```

:::try Запустите pytest
Код ниже записывает модуль и тесты во временную папку и запускает pytest — так же, как это делаете вы в терминале. В модуле есть дефект. Найдите его по отчёту, исправьте строку в `SHOP` и запустите снова.
:::

```widget
{"type":"playground","lang":"py","title":"pytest: отчёт о падении","code":"import os, sys, tempfile, pytest\n\nSHOP = '''\ndef cart_total(items):\n    return sum(i[\"price\"] for i in items)\n'''\n\nTESTS = '''\nfrom shop import cart_total\n\ndef test_empty_cart_is_zero():\n    assert cart_total([]) == 0\n\ndef test_total_counts_quantity():\n    assert cart_total([{\"price\": 390, \"qty\": 2}]) == 780\n'''\n\nd = tempfile.mkdtemp()\nfor name, text in ((\"shop.py\", SHOP), (\"test_cart.py\", TESTS)):\n    with open(os.path.join(d, name), \"w\", encoding=\"utf-8\") as f:\n        f.write(text)\nfor mod in (\"shop\", \"test_cart\"):\n    sys.modules.pop(mod, None)\npytest.main([\"-q\", \"-p\", \"no:cacheprovider\", \"--color=no\", d])\nfor mod in (\"shop\", \"test_cart\"):  # убрать учебные модули из кеша импорта\n    sys.modules.pop(mod, None)\n"}
```

:::happened
pytest нашёл два теста: пустая корзина прошла, а тест с количеством упал с `assert 390 == 780`. Строка `where 390 = cart_total(...)` подсказывает, что функция вернула цену одной штуки. После замены на `i["price"] * i["qty"]` оба теста проходят. Тест на пустую корзину этот дефект не ловит — поэтому граничные и «типичные» случаи нужны вместе.
:::

## Задание

```widget
{"type":"exercise","id":"py-test-cart"}
```

:::deep Почему простой assert
В `unittest` из стандартной библиотеки проверки пишут методами `self.assertEqual(a, b)`, а тесты — классами. pytest при импорте тестового модуля переписывает байт-код `assert` и при падении выводит значения всех частей выражения. Поэтому `assert order["total"] == expected` даёт отчёт не хуже специализированных методов, а тесты остаются обычными функциями. pytest умеет запускать и тесты `unittest`, так что переход возможен постепенно.
:::

:::tech Структура проекта
Обычно тесты лежат в папке `tests/`, а настройки — в `pyproject.toml` (секция `[tool.pytest.ini_options]`) или `pytest.ini`: пути к тестам, маркеры, опции по умолчанию (`addopts = "-q"`). Код, общий для многих тестов (fixtures), помещают в `conftest.py` — pytest подхватывает его автоматически. Об этом — в следующем уроке.
:::

:::interview
**Вопрос:** «Чем pytest удобнее unittest?» **Ответ по сути:** тесты — обычные функции, проверки — обычный `assert` с подробным выводом значений, мощные fixtures с областями видимости и зависимостями, параметризация, богатая экосистема плагинов (xdist для параллельности, отчёты). Совместим с тестами unittest.
:::

:::terms
[[pytest]], [[assertion]], [[unit-testing|юнит-тестирование]], [[negative-testing|негативное тестирование]]
:::
