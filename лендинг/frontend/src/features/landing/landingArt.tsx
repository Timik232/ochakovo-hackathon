/*
 * SVG-арт лендинга: дословный перенос иллюстраций из прототипа v4
 * (ochakovo-career/public/index.html): hero-композиция, наклейки,
 * иконки столпов и символы профессий. Пути и координаты не меняем.
 */

const INK = "#2B2B2E";
const RED = "#D50032";
const LIGHT = "#E9EAEB";

/** Общие defs: растровые паттерны для заливок бутылки и котла. Рендерить один раз на странице. */
export function LandingArtDefs() {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="och-dots" width={8} height={8} patternUnits="userSpaceOnUse">
          <circle cx={4} cy={4} r={1.6} fill={RED} />
        </pattern>
        <pattern id="och-dotsw" width={8} height={8} patternUnits="userSpaceOnUse">
          <circle cx={4} cy={4} r={1.5} fill="#fff" opacity={0.7} />
        </pattern>
      </defs>
    </svg>
  );
}

export function HeroFlash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 400" aria-hidden="true" focusable="false">
      <path
        d="M200 8l26 70 52-52-2 74 72-20-40 62 74 18-66 34 56 50-74-6 18 72-60-42-12 74-44-60-44 60-12-74-60 42 18-72-74 6 56-50-66-34 74-18-40-62 72 20-2-74 52 52z"
        fill="#fff"
        stroke={INK}
        strokeWidth={6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeroBottle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 420" aria-hidden="true" focusable="false">
      <g stroke={INK} strokeWidth={6} strokeLinejoin="round">
        <rect x={80} y={8} width={60} height={34} rx={6} fill={RED} />
        <path d="M88 18v16M100 18v16M112 18v16M124 18v16" strokeWidth={3} />
        <path
          d="M84 42h52v26c30 16 44 40 44 70v250a20 20 0 0 1-20 20H60a20 20 0 0 1-20-20V138c0-30 14-54 44-70z"
          fill={RED}
        />
        <path
          d="M84 42h52v26c30 16 44 40 44 70v250a20 20 0 0 1-20 20H60a20 20 0 0 1-20-20V138c0-30 14-54 44-70z"
          fill="url(#och-dotsw)"
          stroke="none"
          opacity={0.5}
        />
        <rect x={40} y={190} width={140} height={120} fill="#fff" />
        <path
          d="M110 204l10 22 24-6-14 20 20 14-24 4 4 24-20-14-20 14 4-24-24-4 20-14-14-20 24 6z"
          fill="#fff"
          strokeWidth={4}
        />
        <path
          d="M110 236v40M110 246l-10-8M110 256l10-8M110 266l-10-8"
          stroke={RED}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <path d="M56 330h108" stroke="#fff" strokeWidth={5} strokeDasharray="1 16" strokeLinecap="round" />
        <path d="M64 100c-8 14-10 30-10 44" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.7} />
      </g>
    </svg>
  );
}

export function StickerHeart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 110" aria-hidden="true" focusable="false">
      <path
        d="M60 102C20 74 6 52 6 32 6 16 18 6 32 6c12 0 22 7 28 18 6-11 16-18 28-18 14 0 26 10 26 26 0 20-14 42-54 70z"
        fill={RED}
        stroke={INK}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M26 30c2-8 8-12 14-12" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function StickerArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 130" aria-hidden="true" focusable="false">
      <path
        d="M50 6l42 50H66v68H34V56H8z"
        fill={RED}
        stroke={INK}
        strokeWidth={6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StickerCap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 140" aria-hidden="true" focusable="false">
      <path
        d="M70 6l9 13 15-6 3 16 16 0-3 16 15 6-9 13 11 12-14 8 5 15-16 3-1 16-15-5-8 14-12-11-12 11-8-14-15 5-1-16-16-3 5-15-14-8 11-12-9-13 15-6-3-16 16 0 3-16 15 6z"
        fill="#fff"
        stroke={INK}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <circle cx={70} cy={70} r={38} fill={RED} stroke={INK} strokeWidth={5} />
      <path
        d="M70 50v42M70 60l-10-8M70 70l10-8M70 80l-10-8"
        stroke="#fff"
        strokeWidth={5}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StickerSpark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path
        d="M20 2c2 10 8 16 18 18-10 2-16 8-18 18-2-10-8-16-18-18C12 18 18 12 20 2z"
        fill="#fff"
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type PillarIconName = "eye" | "home" | "shelf" | "up" | "shield";

const PILLAR_ICONS: Record<PillarIconName, React.ReactNode> = {
  eye: (
    <g fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx={12} cy={12} r={3} />
    </g>
  ),
  home: (
    <g fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9H3z" />
      <path d="M10 20v-6h4v6" />
    </g>
  ),
  shelf: (
    <g fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20h18M3 13h18" />
      <path d="M6 13V7h3v6M11 13V5h3v8M16 13V8h3v5M6 20v-4h4v4M13 20v-4h5v4" />
    </g>
  ),
  up: (
    <g fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4v-5h4v-5h4V5h4" />
      <path d="M15 5h5v5" />
    </g>
  ),
  shield: (
    <g fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </g>
  ),
};

export function PillarIcon({ name }: { name: PillarIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PILLAR_ICONS[name]}
    </svg>
  );
}

const ART_STROKE = {
  stroke: INK,
  strokeWidth: 5,
  strokeLinejoin: "round",
  strokeLinecap: "round",
} as const;

function LabArt() {
  return (
    <g {...ART_STROKE}>
      <rect x={196} y={92} width={96} height={16} rx={3} fill="#fff" />
      <rect x={206} y={40} width={18} height={96} rx={9} fill="#fff" />
      <path d="M208 96h14v30a7 7 0 0 1-14 0z" fill={RED} />
      <rect x={236} y={30} width={18} height={106} rx={9} fill="#fff" />
      <path d="M238 80h14v46a7 7 0 0 1-14 0z" fill={LIGHT} />
      <rect x={266} y={50} width={18} height={86} rx={9} fill="#fff" />
      <path d="M268 104h14v22a7 7 0 0 1-14 0z" fill={RED} />
      <path d="M96 22h44M106 22v50L58 164a14 14 0 0 0 12 20h96a14 14 0 0 0 12-20L130 72V22" fill="#fff" />
      <path d="M78 128h80l18 36a14 14 0 0 1-12 20H72a14 14 0 0 1-12-20z" fill={RED} />
      <path d="M78 128h80l18 36a14 14 0 0 1-12 20H72a14 14 0 0 1-12-20z" fill="url(#och-dotsw)" stroke="none" />
      <circle cx={100} cy={150} r={7} fill="#fff" />
      <circle cx={130} cy={162} r={5} fill="#fff" />
      <circle cx={118} cy={104} r={6} fill="#fff" />
      <circle cx={128} cy={78} r={4} fill="#fff" />
      <path d="M150 52l8-8M164 60h12M150 34l4-10" strokeWidth={4} />
    </g>
  );
}

function RozlivArt() {
  return (
    <g {...ART_STROKE}>
      <rect x={18} y={146} width={284} height={22} rx={11} fill="#fff" />
      <circle cx={40} cy={157} r={6} fill={INK} />
      <circle cx={100} cy={157} r={6} fill={INK} />
      <circle cx={160} cy={157} r={6} fill={INK} />
      <circle cx={220} cy={157} r={6} fill={INK} />
      <circle cx={280} cy={157} r={6} fill={INK} />
      <path d="M60 180v14M260 180v14M40 194h40M240 194h40" />
      <g>
        <path d="M62 52h20v14c12 8 16 18 16 30v44a6 6 0 0 1-6 6H52a6 6 0 0 1-6-6V96c0-12 4-22 16-30z" fill={RED} />
        <rect x={58} y={40} width={28} height={14} rx={3} fill="#fff" />
        <rect x={50} y={98} width={44} height={26} fill="#fff" />
      </g>
      <g>
        <path d="M142 42h20v16c14 9 18 20 18 34v48a6 6 0 0 1-6 6h-50a6 6 0 0 1-6-6V92c0-14 4-25 18-34z" fill={RED} />
        <rect x={138} y={28} width={28} height={15} rx={3} fill="#fff" />
        <rect x={128} y={94} width={48} height={30} fill="#fff" />
        <path d="M152 100l4 9 10 1-7 7 2 9-9-5-9 5 2-9-7-7 10-1z" fill={RED} strokeWidth={2.5} />
      </g>
      <g>
        <path d="M222 52h20v14c12 8 16 18 16 30v44a6 6 0 0 1-6 6h-40a6 6 0 0 1-6-6V96c0-12 4-22 16-30z" fill="#fff" />
        <rect x={218} y={40} width={28} height={14} rx={3} fill={LIGHT} />
      </g>
      <path d="M280 70h26M292 58l14 12-14 12" strokeWidth={6} />
      <circle cx={232} cy={110} r={5} fill="#fff" />
      <circle cx={240} cy={90} r={4} fill="#fff" />
    </g>
  );
}

function TechArt() {
  return (
    <g {...ART_STROKE}>
      <path d="M70 70c0-30 30-46 60-46s60 16 60 46v84a10 10 0 0 1-10 10H80a10 10 0 0 1-10-10z" fill="#fff" />
      <path d="M70 92h120v62a10 10 0 0 1-10 10H80a10 10 0 0 1-10-10z" fill={RED} />
      <path d="M70 92h120v62a10 10 0 0 1-10 10H80a10 10 0 0 1-10-10z" fill="url(#och-dotsw)" stroke="none" />
      <circle cx={130} cy={60} r={16} fill={LIGHT} />
      <path d="M130 50v10l7 5" strokeWidth={4} />
      <path d="M90 164v22M170 164v22M80 186h20M160 186h20" />
      <path d="M190 110h40v-40h34" fill="none" strokeWidth={10} />
      <path d="M190 110h40v-40h34" fill="none" stroke="#fff" strokeWidth={3} />
      <path d="M118 22c-6-10 6-14 0-24M142 22c-6-10 6-14 0-24" fill="none" strokeWidth={4} />
      <path d="M232 132c0-10 8-16 18-16h22c10 0 18 6 18 16v42a8 8 0 0 1-8 8h-42a8 8 0 0 1-8-8z" fill="#fff" />
      <path d="M244 116l8-10h18l8 10" fill="#fff" />
      <text x={261} y={160} textAnchor="middle" fontFamily="Montserrat,Arial" fontWeight={900} fontSize={11} fill={RED} stroke="none">
        САХАР
      </text>
    </g>
  );
}

function SkladArt() {
  return (
    <g {...ART_STROKE}>
      <rect x={30} y={30} width={150} height={104} rx={8} fill="#fff" />
      <path d="M44 52h122M44 74h122M44 96h122M90 44v76M130 44v76" strokeWidth={3} />
      <rect x={48} y={58} width={36} height={12} fill={RED} strokeWidth={2.5} />
      <path d="M140 82l6 6 12-12" stroke={RED} strokeWidth={4} />
      <path d="M90 134v24M60 160h90" />
      <rect x={200} y={118} width={70} height={56} fill={RED} />
      <rect x={200} y={118} width={70} height={56} fill="url(#och-dotsw)" stroke="none" />
      <rect x={222} y={70} width={58} height={48} fill="#fff" />
      <path d="M222 86h58" strokeWidth={3} />
      <path d="M232 98v10M238 98v10M242 98v10M248 98v10M256 98v10M262 98v10M266 98v10" strokeWidth={2.5} />
      <path d="M168 150l26-30 14 12-26 30z" fill={LIGHT} />
      <path d="M196 124l18-8" stroke={RED} strokeWidth={4} />
    </g>
  );
}

function KladovArt() {
  return (
    <g {...ART_STROKE}>
      <rect x={40} y={166} width={170} height={14} fill="#fff" />
      <path d="M52 180v12M125 180v12M198 180v12" />
      <rect x={44} y={110} width={78} height={56} fill={RED} />
      <rect x={122} y={110} width={84} height={56} fill="#fff" />
      <rect x={70} y={58} width={86} height={52} fill="#fff" />
      <path d="M113 58v18M95 110v14M164 110v14" strokeWidth={3} />
      <path d="M136 130h24" strokeWidth={3} />
      <rect x={216} y={24} width={84} height={112} rx={6} fill="#fff" transform="rotate(8 258 80)" />
      <rect x={240} y={16} width={36} height={14} rx={3} fill={RED} transform="rotate(8 258 80)" />
      <g transform="rotate(8 258 80)" strokeWidth={3}>
        <path d="M230 52l5 5 9-9M252 52h36M230 76l5 5 9-9M252 76h36M230 100l5 5 9-9M252 100h28" />
      </g>
      <text x={83} y={145} textAnchor="middle" fontFamily="Montserrat,Arial" fontWeight={900} fontSize={15} fill="#fff" stroke="none">
        ТТН
      </text>
    </g>
  );
}

function MashArt() {
  return (
    <g {...ART_STROKE}>
      <path d="M30 70h260v100a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8z" fill="#fff" />
      <path d="M30 70l20-40h220l20 40z" fill={LIGHT} />
      <circle cx={90} cy={112} r={30} fill="#fff" />
      <path d="M66 112a24 24 0 0 1 48 0" fill="none" stroke={RED} strokeWidth={7} />
      <path d="M90 112l14-16" />
      <circle cx={90} cy={112} r={5} fill={INK} />
      <circle cx={170} cy={112} r={30} fill="#fff" />
      <path d="M146 112a24 24 0 0 1 48 0" fill="none" stroke={RED} strokeWidth={7} />
      <path d="M170 112l-16-12" />
      <circle cx={170} cy={112} r={5} fill={INK} />
      <rect x={220} y={86} width={48} height={56} rx={4} fill={RED} />
      <path d="M232 100h24M232 114h24M232 128h14" stroke="#fff" strokeWidth={4} />
      <circle cx={70} cy={160} r={8} fill={RED} />
      <circle cx={96} cy={160} r={8} fill="#fff" />
      <circle cx={122} cy={160} r={8} fill={INK} />
      <path d="M170 166v-16" />
      <rect x={160} y={140} width={20} height={12} rx={3} fill={RED} />
      <path d="M200 160h70" strokeWidth={3} />
      <path d="M126 46h12M148 46h40" strokeWidth={3} />
    </g>
  );
}

function TechnologArt() {
  return (
    <g {...ART_STROKE}>
      <rect x={30} y={34} width={120} height={146} rx={6} fill="#fff" transform="rotate(-6 90 107)" />
      <g transform="rotate(-6 90 107)">
        <text x={90} y={64} textAnchor="middle" fontFamily="Montserrat,Arial" fontWeight={900} fontSize={14} fill={RED} stroke="none">
          РЕЦЕПТ
        </text>
        <path d="M48 84h52M48 104h70M48 124h44M48 144h60" strokeWidth={3} />
        <circle cx={118} cy={84} r={5} fill={RED} strokeWidth={2.5} />
      </g>
      <circle cx={206} cy={128} r={34} fill="#fff" />
      <circle cx={206} cy={128} r={24} fill={RED} strokeWidth={3} />
      <path d="M206 104v48M182 128h48M189 111l34 34M223 111l-34 34" stroke="#fff" strokeWidth={3} />
      <path d="M262 40c-14 14-14 34 0 48 14-14 14-34 0-48z" fill="#fff" />
      <path d="M262 56c-10 8-10 20 0 28 10-8 10-20 0-28z" fill={RED} strokeWidth={3} />
      <path d="M262 88v60" />
      <path d="M262 108l-14-8M262 124l14-8M262 140l-14-8" strokeWidth={4} />
      <circle cx={198} cy={44} r={24} fill="#fff" strokeWidth={4} />
      <circle cx={174} cy={76} r={6} fill="#fff" strokeWidth={3} />
      <circle cx={164} cy={90} r={3.5} fill="#fff" strokeWidth={2.5} />
      <text x={198} y={53} textAnchor="middle" fontFamily="Montserrat,Arial" fontWeight={900} fontSize={26} fill={RED} stroke="none">
        ?
      </text>
    </g>
  );
}

function FreeArt() {
  return (
    <g {...ART_STROKE}>
      <path
        d="M150 14l14 30 30-14-6 32 34 4-26 22 22 26-34 2 4 32-28-18-18 28-10-32-32 10 14-30-30-14 30-12-12-30 32 8z"
        fill="#fff"
      />
      <text x={152} y={122} textAnchor="middle" fontFamily="Montserrat,Arial" fontWeight={900} fontSize={64} fill={RED} stroke="none">
        ?
      </text>
      <path d="M232 170v-70h-18l34-40 34 40h-18v70z" fill={RED} />
      <path d="M40 160h60M40 176h40" stroke="#fff" strokeWidth={5} />
    </g>
  );
}

const VACANCY_ART: Record<string, () => React.ReactElement> = {
  lab: LabArt,
  rozliv: RozlivArt,
  tech: TechArt,
  sklad: SkladArt,
  kladov: KladovArt,
  mash: MashArt,
  technolog: TechnologArt,
  free: FreeArt,
};

/**
 * Иллюстрация вакансии по slug. Неизвестный slug (например «open» или новый)
 * получает арт «Учебная практика» — взрыв со знаком вопроса.
 */
export function VacancyArt({ slug, label }: { slug: string; label: string }) {
  const Art = VACANCY_ART[slug] ?? FreeArt;
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label={label} focusable="false">
      <Art />
    </svg>
  );
}
