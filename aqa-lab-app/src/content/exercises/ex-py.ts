import type { Exercise } from './types';

const good = `def cart_total(items):
    """items — список словарей {"price": число, "qty": целое}."""
    return sum(i["price"] * i["qty"] for i in items)


def apply_promo(total, code):
    if code == "SPRING":
        return round(total * 0.9, 2)
    if code is None:
        return total
    raise ValueError("unknown promo code")
`;

const ex: Exercise[] = [
  {
    id: 'py-test-cart',
    lesson: 'py-pytest',
    kind: 'py-test',
    title: 'pytest: тесты для суммы и промокода',
    goal: 'В модуле `shop.py` есть `cart_total(items)` и `apply_promo(total, code)` (SPRING — скидка 10 %, None — без скидки, иное — `ValueError`). Напишите тесты, которые проходят на исправном модуле и ловят каждую из трёх сломанных версий.',
    starter: `from shop import cart_total, apply_promo


def test_total_counts_quantity():
    assert cart_total([{"price": 390, "qty": 2}]) == 780

# TODO: проверьте промокод SPRING, отсутствие промокода и неизвестный код
`,
    solution: `import pytest
from shop import cart_total, apply_promo


def test_total_counts_quantity():
    assert cart_total([{"price": 390, "qty": 2}]) == 780


def test_empty_cart_is_zero():
    assert cart_total([]) == 0


def test_spring_gives_10_percent():
    assert apply_promo(1000, "SPRING") == 900


def test_no_promo_keeps_total():
    assert apply_promo(1000, None) == 1000


def test_unknown_promo_is_rejected():
    with pytest.raises(ValueError):
        apply_promo(1000, "FREE")
`,
    explanation: 'Каждый тест проверяет одно правило: количество в сумме, скидку, отсутствие скидки и отказ для неизвестного кода. `pytest.raises` проверяет, что ошибка действительно возникает — без него сломанная версия, молча принимающая любой код, прошла бы.',
    hints: [
      'Для каждого правила из описания нужен отдельный тест.',
      'Ошибку проверяют контекстным менеджером `with pytest.raises(ValueError):` — не забудьте `import pytest`.',
      '`assert apply_promo(1000, "SPRING") == 900`',
    ],
    good,
    broken: [
      { name: 'Сломано: скидка 20 % вместо 10 %', code: good.replace('total * 0.9', 'total * 0.8') },
      { name: 'Сломано: неизвестный код принимается без ошибки', code: good.replace('raise ValueError("unknown promo code")', 'return total') },
      { name: 'Сломано: без промокода возвращается 0', code: good.replace('if code is None:\n        return total', 'if code is None:\n        return 0') },
    ],
  },
];
export default ex;
