:::why
API отвечает JSON, тестовые данные хранят в JSON-файлах, отчёты сохраняют в JSON. Python-тесту нужно уметь превратить текст в структуры, проверить их и записать результат обратно. Для этого есть стандартный модуль `json` — и немного правил работы с файлами и модулями.
:::

## Модули и import

Модуль — это файл `.py`. Чтобы использовать код из другого модуля, его импортируют:

```py tests/test_orders.py
import json                       # весь модуль: json.loads(...)
from pathlib import Path          # одно имя из модуля
from helpers import line_total    # свой модуль helpers.py рядом
```

Стандартная библиотека Python большая: `json`, `pathlib`, `datetime`, `decimal`, `re`, `unittest.mock`, `csv` — всё это доступно без установки. Сторонние пакеты (`requests`, `pydantic`) ставятся через pip — об этом в следующем уроке.

Код модуля выполняется при первом импорте. Поэтому в модулях с функциями не пишут «запускаемый» код на верхнем уровне, а прячут его под `if __name__ == "__main__":` — этот блок выполнится, только если файл запустили напрямую.

## json: текст ↔ структуры

[[json|JSON]] почти совпадает с литералами Python, но это **текст**. Модуль `json` переводит его в структуры и обратно:

| JSON | Python |
|---|---|
| объект `{}` | `dict` |
| массив `[]` | `list` |
| строка `"…"` | `str` |
| число `5`, `5.5` | `int`, `float` |
| `true` / `false` | `True` / `False` |
| `null` | `None` |

```py tests/test_order_json.py
import json

body = '{"id": 101, "status": "paid", "total": 5770, "promo_code": null}'
order = json.loads(body)          # str → dict
print(order["total"] + 1)         # 5771 — уже число
print(order["promo_code"])        # None

text = json.dumps(order, ensure_ascii=False, indent=2)   # dict → str
```

`loads`/`dumps` (s — string) работают со строками, `load`/`dump` — с открытыми файлами.

Если текст — не JSON, `json.loads` бросает `json.JSONDecodeError`. Это подкласс `ValueError`, сообщение указывает строку и столбец: `Expecting property name enclosed in double quotes: line 1 column 2`. Для API-теста это само по себе находка: сервер обещал JSON, а прислал HTML-страницу ошибки.

## Файлы

Файл открывают через `with open(...)` — блок `with` гарантирует, что файл закроется, даже если внутри произойдёт ошибка:

```py tests/data_files.py
import json
from pathlib import Path

path = Path("testdata") / "orders.json"

with open(path, encoding="utf-8") as f:     # чтение
    orders = json.load(f)

with open("report.json", "w", encoding="utf-8") as f:   # запись ("w" — перезаписать)
    json.dump({"checked": len(orders)}, f, ensure_ascii=False, indent=2)
```

Две детали, которые экономят часы: всегда указывайте `encoding="utf-8"` (иначе на Windows кодировка будет другой) и `ensure_ascii=False`, если в данных есть кириллица, — иначе в файле окажется `"\u0411\u043b\u043e\u043a…"`. `pathlib.Path` склеивает пути через `/` одинаково на всех системах.

:::try Разберите ответ API
Запустите код: он разбирает ответ, считает сводку и сохраняет её в файл, а затем читает файл обратно. Испортите JSON в `body` (например, уберите кавычку) и посмотрите на сообщение об ошибке.
:::

```widget
{"type":"playground","lang":"py","title":"JSON ответа → сводка → файл","code":"import json\nfrom pathlib import Path\n\nbody = '''{\n  \"id\": 101,\n  \"status\": \"paid\",\n  \"items\": [\n    {\"title\": \"Наушники Pulse\", \"price\": 4990, \"qty\": 1},\n    {\"title\": \"Блокнот A5\", \"price\": 390, \"qty\": 2}\n  ]\n}'''\n\norder = json.loads(body)\nsummary = {\n    \"id\": order[\"id\"],\n    \"total\": sum(i[\"price\"] * i[\"qty\"] for i in order[\"items\"]),\n    \"titles\": [i[\"title\"] for i in order[\"items\"]],\n}\n\npath = Path(\"/tmp/summary.json\")\nwith open(path, \"w\", encoding=\"utf-8\") as f:\n    json.dump(summary, f, ensure_ascii=False, indent=2)\n\nprint(path.read_text(encoding=\"utf-8\"))\nprint(json.dumps(summary))  # по умолчанию ensure_ascii=True\n"}
```

:::happened
`json.loads` превратил текст в словарь, дальше работа шла с обычными структурами Python. Файл записан с `ensure_ascii=False` и читается глазами; последняя строка показывает, как выглядит та же сводка с настройками по умолчанию — кириллица превратилась в `\uXXXX`. Если испортить JSON, `json.loads` бросит `JSONDecodeError` с номером строки и столбца. Файл в тренажёре записан в виртуальную файловую систему браузера и исчезнет после перезагрузки.
:::

## Задание

```widget
{"type":"exercise","id":"py-order-summary"}
```

:::deep Числа и даты в JSON
В JSON нет дат — их передают строками (`"2026-04-01"`, ISO 8601) и разбирают `datetime.date.fromisoformat()`. Нет и `Decimal`: деньги приходят числом (возможна потеря точности) или строкой (`"5770.00"`). Тест должен проверять тип поля, а не только значение: `"780"` и `780` в Python не равны, и это хорошо — такое расхождение с контрактом нужно замечать. `json.dumps` не умеет сериализовать `Decimal` и `datetime` — нужен параметр `default=str`.
:::

:::tech tmp_path в pytest
Тесты, которые пишут файлы, не должны сорить в рабочей папке. В pytest для этого есть встроенная fixture `tmp_path`: тест получает `pathlib.Path` к уникальной временной директории. `def test_save(tmp_path): path = tmp_path / "out.json"`. Так тесты не мешают друг другу и могут выполняться параллельно.
:::

:::interview
**Вопрос:** «Как в Python прочитать JSON из ответа и что может пойти не так?» **Ответ по сути:** `json.loads(text)` (или `response.json()` в requests) возвращает словари и списки. Проблемы: ответ — не JSON (`JSONDecodeError`), нет ожидаемого поля (`KeyError`), неверный тип (строка вместо числа), кодировка при записи файла. Поэтому проверяют `Content-Type`, наличие и типы полей, а файлы открывают с `encoding="utf-8"`.
:::

:::terms
[[json|JSON]], [[response-validation|проверка ответа]]
:::
