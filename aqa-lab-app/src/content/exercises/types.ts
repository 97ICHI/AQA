// Описание задания: цель, предпосылки, стартовый код, эталон, проверка поведения, подсказки, типичные ошибки.
interface Base {
  id: string;
  lesson: string;
  title: string;
  /** что нужно сделать — 1–3 предложения */
  goal: string;
  starter: string;
  /** эталонное решение (показывается на последней ступени подсказок вместе с разбором) */
  solution: string;
  /** разбор эталона */
  explanation: string;
  /** подсказки по ступеням: направление → идея → фрагмент (решение — отдельно) */
  hints: [string, string, string];
  /** типичные ошибки и что они означают */
  mistakes?: string[];
  /** допустимые альтернативные решения (проверяются тем же способом — список для автора и проверки контента) */
  alternatives?: string[];
}

/** TypeScript: код ученика экспортирует функции; проверка (TypeScript) импортирует их из './student' и вызывает на разных входах. */
export interface TsExercise extends Base { kind: 'ts'; check: string }
/** TypeScript: ученик пишет проверку (тест) для готовой функции; она должна проходить на исправной и падать на каждой сломанной версии. */
export interface TsTestExercise extends Base { kind: 'ts-test'; good: string; broken: { name: string; code: string }[] }
/** SQL: результат запроса ученика сравнивается с эталоном на нескольких наборах данных. */
export interface SqlExercise extends Base { kind: 'sql'; reference: string; ordered: boolean; datasets: string[]; /** для INSERT/UPDATE/DELETE: запрос, которым проверяется состояние после выполнения */ verify?: string }
/** Python: код ученика (student.py) проверяется скрытым pytest-файлом. */
export interface PyExercise extends Base { kind: 'py'; check: string }
/** Python: ученик пишет pytest-тесты; они должны проходить на исправной и падать на каждой сломанной версии модуля shop.py. */
export interface PyTestExercise extends Base { kind: 'py-test'; good: string; broken: { name: string; code: string }[] }
/** Playwright: тест ученика запускается настоящим Playwright через локальный runner на исправном магазине и на версиях с дефектами. */
export interface PwExercise extends Base { kind: 'pw'; mustPass: string[]; mustFail: string[] }

export type Exercise = TsExercise | TsTestExercise | SqlExercise | PyExercise | PyTestExercise | PwExercise;
