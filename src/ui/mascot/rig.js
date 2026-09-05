/**
 * Бүркіт — оснастка персонажа.
 *
 * Почему персонаж собран из примитивов, а не нарисован одной фигурой.
 *
 * Нарисованного птенца можно только заменить другим рисунком: чтобы он
 * удивился, нужен второй файл, чтобы обрадовался — третий. Персонаж,
 * собранный из отдельных частей с честными точками вращения, гнётся:
 * бровь поворачивается, хохолок приседает, голова наклоняется — и из тех же
 * восьми фигур получается два десятка выражений. Это ровно тот урок, который
 * Duolingo вынес из редизайна 2019 года, и он важнее качества самой графики.
 *
 * Почему SVG, а не Rive/Lottie. Приложение обязано открываться офлайн на
 * дешёвом Android в сельской школе, а весь его вес — около 60 КБ. Рантайм
 * Rive — это ~200 КБ wasm на критическом пути и запечённые в файл цвета,
 * которые не умеют переключаться в тёмную тему. Здесь же разметка наследует
 * те же CSS-переменные, что и весь интерфейс: тема и акцент достаются даром.
 *
 * Цвета глаз, клюва и бровей — фиксированные, а не токены темы. Персонаж
 * всегда стоит на собственном золотом теле, и «чернила по бумаге» в тёмной
 * теме вывернули бы ему лицо наизнанку.
 */

/** Точки вращения. Без них всё крутится вокруг центра фигуры и разваливается. */
export const ORIGINS = {
  root: '50% 50%',
  shadow: '50% 50%',
  body: '50% 100%',      // приседание — от земли, а не от середины
  tail: '50% 0%',        // хвост тянется за телом, крепление сверху
  wingL: '70% 15%',      // крыло вращается у плеча
  wingR: '30% 15%',
  feet: '50% 50%',
  head: '50% 90%',       // голова кивает от шеи
  crest: '50% 100%',     // хохолок приседает от основания
  browL: '50% 100%',
  browR: '50% 100%',
  lids: '50% 0%',        // веко опускается сверху вниз
  pupils: '50% 50%',
  beakBottom: '50% 0%',  // клюв открывается вниз
  zzz: '50% 100%',
};

export const PART_IDS = Object.keys(ORIGINS);

/**
 * Разметка. Один `<g>` на часть, id — ключ из ORIGINS.
 *
 * Веки лежат поверх глаз и в покое сжаты в ноль по высоте: моргание — это
 * анимация scaleY 0 → 1 → 0, а не подмена картинки. Обрезка по clipPath
 * нужна, чтобы прямоугольник века не вылезал за круг глаза.
 */
export function rigSvg(id = 'm') {
  return `
<svg viewBox="0 0 120 152" class="mascot-svg" aria-hidden="true" focusable="false">
  <defs>
    <clipPath id="${id}-eyeL"><circle cx="49" cy="50" r="10"/></clipPath>
    <clipPath id="${id}-eyeR"><circle cx="72" cy="50" r="10"/></clipPath>
  </defs>

  <g id="${id}-root">
    <!-- Тень лежит первой и потому под всеми. Она не украшение: прыжок без
         тени читается как «фигура уехала вверх», прыжок с тенью, которая в
         этот момент сжимается и бледнеет, — как «оттолкнулся от земли».
         Это самый дешёвый способ дать персонажу вес. -->
    <ellipse id="${id}-shadow" cx="60" cy="144" rx="25" ry="4.5" fill="var(--m-shadow)"/>

    <!-- Хвост: три пера разной длины, со сдвигом вправо. Симметричный веер
         читался бы как значок; сбитая на одну сторону связка — как хвост. -->
    <g id="${id}-tail">
      <path d="M58 116 L40 138 L52 136 L54 143 L64 134 Z" fill="var(--m-wing)"
            stroke="var(--m-ink)" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    </g>

    <g id="${id}-body">
      <!-- Тело: не эллипс. Плечи шире, низ тяжелее, силуэт чуть завален
           влево — из-за этого он стоит, а не висит по центру макета. -->
      <path d="M60 64c-20 0-32 14-33 32-1 21 14 35 33 35s34-14 33-35c-1-18-13-32-33-32z"
            fill="var(--m-body)" stroke="var(--m-ink)" stroke-width="3.2" stroke-linejoin="round"
            vector-effect="non-scaling-stroke"/>
      <!-- Грудка — сплошная плашка, а не полупрозрачное пятно: полупрозрачность
           даёт «мыло», плоский блок с краем — рисунок. -->
      <path d="M60 86c-10 0-16 9-16 21 0 11 7 18 16 18s16-7 16-18c0-12-6-21-16-21z"
            fill="var(--m-belly)"/>

      <g id="${id}-wingL">
        <path d="M29 84c-8 3-11 13-10 23l2 16 7-8 5 8 3-16z" fill="var(--m-wing)"
              stroke="var(--m-ink)" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </g>
      <g id="${id}-wingR">
        <path d="M91 84c8 3 11 13 10 23l-2 16-7-8-5 8-3-16z" fill="var(--m-wing)"
              stroke="var(--m-ink)" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </g>

      <g id="${id}-feet">
        <path d="M51 126v9M43 139l8-4 8 4M70 126v9M62 139l8-4 8 4"
              stroke="var(--m-ink)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"
              fill="none" vector-effect="non-scaling-stroke"/>
      </g>
    </g>

    <g id="${id}-head">
      <!-- Хохолок: три пера, разной высоты и со сдвигом. Ровный гребень из
           одинаковых зубцов — это корона из клипарта. -->
      <g id="${id}-crest">
        <path d="M42 28L38 9l13 15z" fill="var(--m-wing)" stroke="var(--m-ink)" stroke-width="2.8"
              stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <path d="M50 23L52 1l10 19z" fill="var(--m-wing)" stroke="var(--m-ink)" stroke-width="2.8"
              stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <path d="M60 22L70 12l1 13z" fill="var(--m-wing)" stroke="var(--m-ink)" stroke-width="2.8"
              stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </g>

      <!-- Голова шире внизу: у беркута тяжёлая нижняя челюсть, и именно это
           отличает силуэт хищной птицы от птенца-кружка. -->
      <path d="M60 21c-15 0-26 11-26 26 0 16 11 27 26 27s26-11 26-27c0-15-11-26-26-26z"
            fill="var(--m-body)" stroke="var(--m-ink)" stroke-width="3.2" stroke-linejoin="round"
            vector-effect="non-scaling-stroke"/>

      <g id="${id}-eyes">
        <circle cx="49" cy="50" r="10" fill="var(--m-eye)" stroke="var(--m-ink)" stroke-width="2.6"
                vector-effect="non-scaling-stroke"/>
        <circle cx="72" cy="50" r="10" fill="var(--m-eye)" stroke="var(--m-ink)" stroke-width="2.6"
                vector-effect="non-scaling-stroke"/>
        <g id="${id}-pupils">
          <circle cx="49" cy="50" r="5" fill="var(--m-ink)"/>
          <circle cx="72" cy="50" r="5" fill="var(--m-ink)"/>
          <!-- Блик квадратный, а не круглый: круглый блик — след кисти из
               стокового рисунка, квадратный читается как решение. -->
          <rect x="50.4" y="46.4" width="3" height="3" rx=".6" fill="var(--m-eye)"/>
          <rect x="73.4" y="46.4" width="3" height="3" rx=".6" fill="var(--m-eye)"/>
        </g>
        <g id="${id}-lids" class="m-lids">
          <rect x="38" y="30" width="22" height="20" fill="var(--m-body)" clip-path="url(#${id}-eyeL)"/>
          <rect x="61" y="30" width="22" height="20" fill="var(--m-body)" clip-path="url(#${id}-eyeR)"/>
        </g>
      </g>

      <!-- Надбровные дуги — толстые, чуть сведённые к центру. Это единственная
           деталь, которая превращает круглую голову в голову беркута, и
           единственное место, где линия толще контура. -->
      <g id="${id}-brows">
        <path id="${id}-browL" d="M37 33l18 6" stroke="var(--m-ink)" stroke-width="4.4" fill="none"
              stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <path id="${id}-browR" d="M84 33l-18 6" stroke="var(--m-ink)" stroke-width="4.4" fill="none"
              stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      </g>

      <!-- Клюв с крючком: прямой треугольник — это воробей. Загнутый вниз
           кончик — хищник, и он же держит всю «породу» персонажа. -->
      <g id="${id}-beak">
        <!-- Нижняя челюсть рисуется ПЕРВОЙ и потому лежит под верхней: в покое
             её почти не видно, а раскрываясь (она и есть анимируемая часть),
             она выезжает из-под крючка и показывает тёмный зев. Обратный
             порядок давал чёрное пятно посреди лица — «кричащий рот». -->
        <path id="${id}-beakBottom" d="M53 62h14c-1 6-4 10-7 11-3-1-6-5-7-11z"
              fill="var(--m-ink)"/>
        <path d="M49 58h22c0 6-2 10-5 13-1 5-5 8-9 6-5-2-8-9-8-19z"
              fill="var(--m-wing)" stroke="var(--m-ink)" stroke-width="3" stroke-linejoin="round"
              stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      </g>
    </g>

    <g id="${id}-zzz" opacity="0">
      <text x="94" y="28" font-size="15" font-weight="700" fill="var(--m-ink)" font-family="var(--font-mono)">z</text>
      <text x="104" y="15" font-size="10" font-weight="700" fill="var(--m-ink)" font-family="var(--font-mono)">z</text>
    </g>
  </g>
</svg>`;
}

/**
 * Статичные позы.
 *
 * Нужны не только для режима «calm» и prefers-reduced-motion. Это ещё и
 * проверка самой оснастки: если поза «радость» и поза «грусть» без единого
 * перехода не читаются как разные состояния, никакая анимация поверх этого
 * уже не спасёт. Выражение делают брови, хохолок и наклон головы — крылья
 * только досказывают.
 */
export const POSES = {
  neutral: {
    shadow: 'scale(1,1)',
    /* root обязан быть в позе покоя: уход со сцены (`exit`) оставляет
       персонажа улетевшим за край, и без явного возврата он бы не вернулся
       на следующем экране — только состояние покоя это чинит. */
    root: 'translate(0,0) rotate(0deg) scale(1)',
    body: 'scale(1,1)', head: 'rotate(0deg) translateY(0)', crest: 'rotate(0deg) scaleY(1)',
    browL: 'rotate(0deg) translateY(0)', browR: 'rotate(0deg) translateY(0)',
    wingL: 'rotate(0deg)', wingR: 'rotate(0deg)', lids: 'scaleY(0)', tail: 'rotate(0deg)',
  },
  happy: {
    shadow: 'scale(.86,.8)',
    body: 'translateY(-6px) scale(.97,1.05)', head: 'rotate(-4deg) translateY(-4px)',
    crest: 'rotate(-12deg) scaleY(1.22)',
    browL: 'rotate(-9deg) translateY(-2px)', browR: 'rotate(9deg) translateY(-2px)',
    wingL: 'rotate(-42deg)', wingR: 'rotate(42deg)', lids: 'scaleY(0)', tail: 'rotate(5deg)',
  },
  sad: {
    shadow: 'scale(1.08,1.05)',
    body: 'translateY(3px) scale(1.03,.96)', head: 'rotate(3deg) translateY(4px)',
    crest: 'rotate(16deg) scaleY(.66)',
    browL: 'rotate(16deg) translateY(2px)', browR: 'rotate(-16deg) translateY(2px)',
    wingL: 'rotate(6deg)', wingR: 'rotate(-6deg)', lids: 'scaleY(.45)', tail: 'rotate(-4deg)',
  },
  think: {
    body: 'scale(1,1)', head: 'rotate(11deg) translateY(1px)', crest: 'rotate(9deg) scaleY(.8)',
    browL: 'rotate(-13deg) translateY(1px)', browR: 'rotate(6deg) translateY(0)',
    wingL: 'rotate(0deg)', wingR: 'rotate(0deg)', lids: 'scaleY(.25)', tail: 'rotate(0deg)',
  },
  wow: {
    shadow: 'scale(.8,.72)',
    body: 'translateY(-4px) scale(.94,1.08)', head: 'rotate(0deg) translateY(-6px)',
    crest: 'rotate(0deg) scaleY(1.45)',
    browL: 'rotate(-4deg) translateY(-4px)', browR: 'rotate(4deg) translateY(-4px)',
    wingL: 'rotate(-62deg)', wingR: 'rotate(62deg)', lids: 'scaleY(0)', tail: 'rotate(0deg)',
  },
  worried: {
    body: 'scale(1.01,.99)', head: 'rotate(-7deg) translateY(2px)', crest: 'rotate(11deg) scaleY(.78)',
    browL: 'rotate(13deg) translateY(1px)', browR: 'rotate(-6deg) translateY(-1px)',
    wingL: 'rotate(4deg)', wingR: 'rotate(-30deg)', lids: 'scaleY(.15)', tail: 'rotate(0deg)',
  },
  sleep: {
    body: 'scale(1.03,.97)', head: 'rotate(9deg) translateY(4px)', crest: 'rotate(18deg) scaleY(.6)',
    browL: 'rotate(6deg) translateY(3px)', browR: 'rotate(-6deg) translateY(3px)',
    wingL: 'rotate(2deg)', wingR: 'rotate(-2deg)', lids: 'scaleY(1)', tail: 'rotate(-3deg)',
  },
  point: {
    body: 'translateX(-6px) rotate(-4deg)', head: 'rotate(-11deg) translateY(-2px)',
    crest: 'rotate(-8deg) scaleY(1.1)',
    browL: 'rotate(-5deg) translateY(-1px)', browR: 'rotate(11deg) translateY(0)',
    wingL: 'rotate(0deg)', wingR: 'rotate(-58deg)', lids: 'scaleY(0)', tail: 'rotate(-3deg)',
  },
};
