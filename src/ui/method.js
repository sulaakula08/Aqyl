import { html, raw } from './dom.js';
import { getProfile } from '../state.js';
import { BKT } from '../engine/mastery.js';
import { successChance } from '../engine/recommender.js';

/**
 * Страница «Как устроен ИИ».
 *
 * Отдельный экран нужен по двум причинам. Во-первых, объяснимость — заявленное
 * свойство продукта, и её нельзя прятать в README. Во-вторых, на защите проекта
 * жюри спрашивает про архитектуру моделей: здесь всё выложено с формулами
 * и живыми числами текущего пользователя.
 */

function bktTable() {
  // Показываем, как одна и та же попытка двигает оценку с разных стартовых точек.
  const rows = [0.2, 0.5, 0.8];
  const { p_slip: s, p_guess: g, p_transit: tr } = BKT;
  const step = (pL, correct) => {
    const post = correct
      ? (pL * (1 - s)) / (pL * (1 - s) + (1 - pL) * g)
      : (pL * s) / (pL * s + (1 - pL) * (1 - g));
    return post + (1 - post) * tr;
  };
  return rows.map((pL) => `
    <tr>
      <td class="mono">${pL.toFixed(2)}</td>
      <td class="mono" style="color:var(--band-mastered)">${step(pL, true).toFixed(2)}</td>
      <td class="mono" style="color:var(--band-gap)">${step(pL, false).toFixed(2)}</td>
    </tr>`).join('');
}

export function renderMethod() {
  const p = getProfile();
  const theta = p.theta ?? 0;

  return html`
  <div class="page wrap">
    <div class="page-head">
      <div>
        <span class="label label-accent">Методика</span>
        <h1 style="margin-top:12px">Как устроен ИИ в AQYL</h1>
        <p>Ни одна оценка в этом продукте не появляется из ниоткуда. Ниже — все четыре механизма,
        их формулы и живые числа вашего профиля. Если вывод системы кажется неверным, эта страница
        позволяет проверить, где именно он разошёлся с реальностью.</p>
      </div>
    </div>

    <div class="grid g2" style="align-items:start;gap:26px">

      <section class="panel">
        <span class="label label-accent">01 · Оценка освоения</span>
        <h3 style="margin:12px 0 10px">Bayesian Knowledge Tracing</h3>
        <p style="font-size:.93rem">Модель Корбетта и Андерсона (1995), стандарт в интеллектуальных обучающих
        системах. Она отвечает на вопрос «какова вероятность, что ученик действительно владеет темой»,
        и учитывает две неприятности: можно знать и ошибиться, а можно не знать и угадать.</p>

        <div class="formula">P(L | верно) = P(L)·(1−s) ⁄ [ P(L)·(1−s) + (1−P(L))·g ]</div>
        <div class="formula">P(L′) = P(L | ответ) + (1 − P(L | ответ))·τ</div>

        <p style="font-size:.88rem">Параметры: угадывание <span class="mono">g = ${String(BKT.p_guess)}</span>,
        ошибка по невнимательности <span class="mono">s = ${String(BKT.p_slip)}</span>,
        переход «не знал → выучил» <span class="mono">τ = ${String(BKT.p_transit)}</span>.</p>

        <table style="width:100%;margin-top:16px;border-collapse:collapse;font-size:.85rem">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule)" class="label">Было</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule)" class="label">Верный ответ</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule)" class="label">Ошибка</th>
            </tr>
          </thead>
          <tbody>${raw(bktTable())}</tbody>
        </table>
        <p style="font-size:.82rem;margin-top:12px;color:var(--text-faint)">
          Обратите внимание на асимметрию: один верный ответ при низкой оценке двигает её сильно,
          а при высокой — почти нет. Так и должно быть: подтверждать известное менее информативно.
        </p>
      </section>

      <section class="panel">
        <span class="label label-accent">02 · Подбор сложности</span>
        <h3 style="margin:12px 0 10px">Elo-рейтинг и теория тестирования</h3>
        <p style="font-size:.93rem">Способность ученика <span class="mono">θ</span> и сложность задания
        <span class="mono">b</span> живут в одной логит-шкале — как рейтинги в шахматах. Это позволяет
        предсказать вероятность успеха до того, как ученик увидит задание.</p>

        <div class="formula">P(успех) = 1 ⁄ (1 + 10^((b − θ) ⁄ 1.2))</div>
        <div class="formula">θ′ = θ + K·(результат − P(успех)),&nbsp;&nbsp; K = 0.6 ⁄ (1 + 0.06·n)</div>

        <p style="font-size:.88rem">K-фактор убывает с опытом: первые ответы двигают оценку заметно,
        поздние — уточняют её. Ваше текущее значение: <span class="mono">θ = ${theta >= 0 ? '+' : ''}${theta.toFixed(2)}</span>
        после ${String(p.attempts)} ${p.attempts === 1 ? 'попытки' : 'попыток'}.</p>

        <div style="margin-top:16px;display:grid;gap:9px">
          ${raw([-1, 0, 0.5, 1, 1.5].map((b) => {
            const pc = Math.round(successChance(theta, b) * 100);
            return `<div class="progress-row">
              <div class="top"><span>Задание сложности <span class="mono">b = ${b.toFixed(1)}</span></span><span class="mono">${pc}%</span></div>
              <div class="bar bar-strong"><i style="width:${pc}%"></i></div>
            </div>`;
          }).join(''))}
        </div>
        <p style="font-size:.82rem;margin-top:12px;color:var(--text-faint)">
          В практике мы целимся в ≈ 70 % — зона ближайшего развития по Выготскому. В диагностике
          наоборот, в ≈ 50 %: там ответ несёт максимум информации о вас.
        </p>
      </section>

      <section class="panel">
        <span class="label label-accent">03 · Граф знаний</span>
        <h3 style="margin:12px 0 10px">Поиск первопричины и вывод по связям</h3>
        <p style="font-size:.93rem">Ключевой механизм продукта. Темы — узлы, рёбра — отношение
        «нельзя понять X, не владея Y». Граф решает две задачи.</p>

        <p style="font-size:.92rem;margin-top:14px"><strong style="color:var(--text)">Спуск к причине.</strong>
        От слабой темы система идёт вниз по рёбрам. Важное ограничение: спуск происходит, только если
        предпосылка действительно слабая <em>и не сильнее самой темы</em>. Без второго условия система
        сваливалась бы к корню графа всегда, даже когда база в порядке. Приоритет отдаётся предпосылкам,
        по которым есть реальные ответы ученика, а не одни предположения.</p>

        <p style="font-size:.92rem;margin-top:12px"><strong style="color:var(--text)">Оценка непройденного.</strong>
        Темам без единой попытки не ставится «по умолчанию 25 %». Берётся априор из
        <span class="mono">θ</span> и <span class="mono">b</span>, затем накладываются два ограничения:</p>
        <div class="formula">потолок: тема ≤ min(освоение предпосылок) + 0.2</div>
        <div class="formula">пол: тема ≥ max(освоение следствий) × 0.9</div>
        <p style="font-size:.88rem">Второе правило особенно наглядно: если ученик уверенно решает
        квадратные уравнения, значит он владеет раскрытием скобок — иначе не решал бы. Такие оценки
        помечены в интерфейсе как «оценка по графу» и уточняются первым же заданием.</p>
      </section>

      <section class="panel">
        <span class="label label-accent">04 · Репетитор</span>
        <h3 style="margin:12px 0 10px">Сократовская политика ответа</h3>
        <p style="font-size:.93rem">Репетитор работает в двух режимах, и оба подчиняются одному правилу:
        готовый ответ на текущее задание не выдаётся никогда.</p>

        <p style="font-size:.92rem;margin-top:14px"><strong style="color:var(--text)">Офлайн-режим.</strong>
        Вопрос токенизируется и ранжируется по учебному графу — частотное взвешивание с устойчивостью
        к словоформам, так что «уравнения» и «уравнение» находят одно и то же. Дальше определяется
        намерение (объяснить, спланировать, попросить ответ, сдаться), подтягивается карта пробелов,
        и ответ собирается политикой. Ноль сети, ноль стоимости, задержка в миллисекундах.</p>

        <p style="font-size:.92rem;margin-top:12px"><strong style="color:var(--text)">Облачный режим.</strong>
        Тот же собранный контекст уходит в Claude API одним запросом с системным промптом, который
        запрещает выдавать решение и требует отвечать на языке ученика. Ключ хранится только в
        localStorage браузера. Если сеть или ключ недоступны — приложение молча возвращается в офлайн.</p>

        <div class="panel panel-accent panel-tight" style="margin-top:16px">
          <span class="label">Почему так</span>
          <p style="font-size:.9rem;margin-top:8px;color:var(--text)">Модель, которая охотно решает домашнее задание,
          обучает ученика обращаться к модели, а не думать. Мы сознательно сделали продукт менее удобным
          в одной точке, чтобы он был полезным в главной.</p>
        </div>
      </section>
    </div>

    <section class="panel panel-sunk" style="margin-top:26px">
      <span class="label label-accent">Честно о границах</span>
      <h3 style="margin:12px 0 12px">Чего этот прототип пока не делает</h3>
      <div class="grid g3" style="gap:18px">
        <p style="font-size:.9rem"><strong style="color:var(--text)">Параметры не обучены на данных.</strong>
        Значения <span class="mono">g</span>, <span class="mono">s</span>, <span class="mono">τ</span> взяты
        как разумные для школьной математики. На реальных логах их следует оценивать по каждой теме отдельно —
        это первое, что мы сделаем после пилота.</p>
        <p style="font-size:.9rem"><strong style="color:var(--text)">Граф составлен вручную.</strong>
        14 тем и связи между ними написаны нами по программе РК. Масштабирование на все предметы требует
        либо работы методистов, либо извлечения связей из учебников — задача следующего этапа.</p>
        <p style="font-size:.9rem"><strong style="color:var(--text)">Класс в панели учителя — демо-данные.</strong>
        20 учеников сгенерированы детерминированным PRNG, чтобы демонстрация была воспроизводимой.
        Всё, что касается вашего собственного прогресса, считается по-настоящему.</p>
      </div>
    </section>

    <div class="row" style="margin-top:26px">
      <a class="btn btn-primary" href="#/onboarding">Пройти диагностику</a>
      <a class="btn btn-ghost" href="#/graph">Посмотреть граф знаний</a>
    </div>
  </div>`;
}
