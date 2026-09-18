import { type ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path, Text as SvgText } from 'react-native-svg';

// Tielo mascot: chubby lutino cockatiel, ported from design/app-ui (Mascot
// emotions). Crest, wings and extras change with the mood.

export const MASCOT_MOODS = [
  'happy',
  'waving',
  'excited',
  'love',
  'laughing',
  'thinking',
  'surprised',
  'shy',
  'sad',
  'sleepy',
  'oops',
  'cool',
] as const;
export type MascotMood = (typeof MASCOT_MOODS)[number];

const C = {
  body: '#FFD84D',
  deep: '#F2B72C',
  face: '#FFF7D6',
  cheek: '#FF8A4C',
  beak: '#F29C38',
  ink: '#2B1F16',
  feet: '#F49AB0',
  mouth: '#8A3A1A',
  tear: '#6FB3FF',
  heart: '#FF4D6D',
  heartSoft: '#FF8FA3',
  bubble: '#EEDDC9',
  zzz: '#B6A594',
};

const Heart = ({ x, y, s, color }: { x: number; y: number; s: number; color: string }) => (
  <Path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0 3 C0 -1 5 -2 6 2 C7 -2 12 -1 12 3 C12 7 6 10 6 11 C6 10 0 7 0 3 Z"
    fill={color}
  />
);
const Sparkle = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <Path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z"
    fill="#FFC53D"
  />
);

const DotEyes = ({ dx = 0, dy = 0, r = 6 }: { dx?: number; dy?: number; r?: number }) => (
  <G>
    <Circle cx={48 + dx} cy={54 + dy} r={r} fill={C.ink} />
    <Circle cx={72 + dx} cy={54 + dy} r={r} fill={C.ink} />
    <Circle cx={50 + dx} cy={52 + dy} r={2} fill="#FFFFFF" />
    <Circle cx={74 + dx} cy={52 + dy} r={2} fill="#FFFFFF" />
  </G>
);
const ArcEyes = () => (
  <Path d="M42 56 q6 -8 12 0 M66 56 q6 -8 12 0" stroke={C.ink} strokeWidth={3.8} fill="none" strokeLinecap="round" />
);

const BeakClosed = () => <Path d="M55 61 q5 -3 10 0 q0 6 -5 8 q-5 -2 -5 -8 Z" fill={C.beak} />;
const BeakOpen = () => (
  <G>
    <Path d="M54 60 q6 -4 12 0 q-1 4 -6 5 q-5 -1 -6 -5 Z" fill={C.beak} />
    <Ellipse cx={60} cy={68} rx={4.5} ry={3.5} fill={C.mouth} />
    <Path d="M56 70 q4 4 8 0" stroke={C.beak} strokeWidth={3} fill="none" strokeLinecap="round" />
  </G>
);

const crests = {
  default: (
    <G>
      <Path d="M56 26 C48 6 66 -2 78 6 C68 8 64 14 66 26 Z" fill={C.body} />
      <Path d="M50 28 C40 16 46 8 52 10 C48 14 50 20 56 28 Z" fill={C.deep} />
    </G>
  ),
  high: (
    <G>
      <Path d="M56 26 C52 2 62 -6 70 -2 C64 4 62 14 66 26 Z" fill={C.body} />
      <Path d="M62 26 C66 6 80 2 84 8 C76 10 70 16 70 28 Z" fill={C.body} />
      <Path d="M50 28 C42 12 48 4 54 6 C50 12 52 20 56 28 Z" fill={C.deep} />
    </G>
  ),
  droop: (
    <G>
      <Path d="M58 26 C56 12 70 8 84 16 C74 16 68 20 66 28 Z" fill={C.body} />
      <Path d="M52 28 C48 18 56 12 64 14 C58 18 56 22 58 28 Z" fill={C.deep} />
    </G>
  ),
  messy: (
    <G>
      <Path d="M56 26 C44 10 52 0 60 4 C56 10 58 18 62 26 Z" fill={C.body} />
      <Path d="M62 26 C70 8 84 10 82 18 C76 14 70 20 68 28 Z" fill={C.deep} />
      <Path d="M54 28 C40 22 38 12 44 10 C46 18 50 22 58 28 Z" fill={C.body} />
    </G>
  ),
};

const WingLeftRest = () => <Path d="M20 70 q-6 20 12 30 q-4 -14 -2 -28 Z" fill={C.deep} />;
const WingRightRest = () => <Path d="M100 70 q6 20 -12 30 q4 -14 2 -28 Z" fill={C.deep} />;
const WingRightUp = () => <Path d="M96 66 C104 50 114 40 118 44 C118 54 110 66 100 76 Z" fill={C.deep} />;
const WingLeftUp = () => <Path d="M24 66 C16 50 6 40 2 44 C2 54 10 66 20 76 Z" fill={C.deep} />;

function parts(mood: MascotMood) {
  let crest = crests.default;
  let wings: ReactNode = (
    <>
      <WingLeftRest />
      <WingRightRest />
    </>
  );
  let eyes: ReactNode = <DotEyes />;
  let mouth: ReactNode = <BeakClosed />;
  let cheekR = 9;
  let front: ReactNode = null;
  let extra: ReactNode = null;

  switch (mood) {
    case 'happy':
      eyes = <ArcEyes />;
      break;
    case 'waving':
      eyes = <ArcEyes />;
      wings = (
        <>
          <WingLeftRest />
          <WingRightUp />
          <Path d="M108 30 q6 2 8 8 M112 22 q8 4 10 12" stroke={C.deep} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </>
      );
      break;
    case 'excited':
      crest = crests.high;
      eyes = <ArcEyes />;
      mouth = <BeakOpen />;
      wings = (
        <>
          <WingLeftUp />
          <WingRightUp />
        </>
      );
      extra = (
        <>
          <Sparkle x={14} y={26} s={1.1} />
          <Sparkle x={106} y={18} s={0.9} />
          <Sparkle x={100} y={100} s={0.7} />
        </>
      );
      break;
    case 'love':
      eyes = (
        <>
          <Heart x={42} y={48} s={1} color={C.heart} />
          <Heart x={66} y={48} s={1} color={C.heart} />
        </>
      );
      extra = (
        <>
          <Heart x={92} y={14} s={1.2} color={C.heart} />
          <Heart x={18} y={24} s={0.8} color={C.heartSoft} />
        </>
      );
      break;
    case 'laughing':
      eyes = (
        <Path
          d="M42 50 l10 5 l-10 5 M78 50 l-10 5 l10 5"
          stroke={C.ink}
          strokeWidth={3.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      mouth = <BeakOpen />;
      wings = (
        <>
          <WingLeftUp />
          <WingRightUp />
        </>
      );
      break;
    case 'thinking':
      eyes = <DotEyes dx={3} dy={-3} r={5.5} />;
      wings = (
        <>
          <WingLeftRest />
          <Path d="M98 74 C92 80 78 80 72 74 C78 70 90 66 100 70 Z" fill={C.deep} />
        </>
      );
      extra = (
        <>
          <Circle cx={94} cy={30} r={3} fill={C.bubble} />
          <Circle cx={102} cy={20} r={4.5} fill={C.bubble} />
          <Circle cx={110} cy={8} r={7} fill={C.bubble} />
          <SvgText x={110} y={12} fontSize={10} fontWeight="700" fill={C.ink} textAnchor="middle">
            ?
          </SvgText>
        </>
      );
      break;
    case 'surprised':
      crest = crests.high;
      eyes = (
        <>
          <Circle cx={48} cy={53} r={8} fill="#FFFFFF" stroke={C.ink} strokeWidth={2} />
          <Circle cx={72} cy={53} r={8} fill="#FFFFFF" stroke={C.ink} strokeWidth={2} />
          <Circle cx={48} cy={53} r={4} fill={C.ink} />
          <Circle cx={72} cy={53} r={4} fill={C.ink} />
        </>
      );
      mouth = (
        <>
          <Path d="M55 60 q5 -3 10 0 q-1 3 -5 4 q-4 -1 -5 -4 Z" fill={C.beak} />
          <Ellipse cx={60} cy={68} rx={3.5} ry={4} fill={C.mouth} />
        </>
      );
      extra = (
        <>
          <Path d="M104 12 v14" stroke={C.cheek} strokeWidth={4} strokeLinecap="round" />
          <Circle cx={104} cy={33} r={2.4} fill={C.cheek} />
        </>
      );
      break;
    case 'shy':
      eyes = (
        <Path d="M42 54 q6 5 12 0 M66 54 q6 5 12 0" stroke={C.ink} strokeWidth={3.4} fill="none" strokeLinecap="round" />
      );
      cheekR = 10;
      front = (
        <Path d="M78 64 l3 -3 M83 66 l3 -3 M88 68 l3 -3" stroke="#D9542B" strokeWidth={1.8} strokeLinecap="round" />
      );
      break;
    case 'sad':
      crest = crests.droop;
      eyes = (
        <>
          <DotEyes dy={2} r={5.5} />
          <Path d="M40 47 l12 -5 M80 47 l-12 -5" stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
        </>
      );
      mouth = <Path d="M55 63 q5 -2 10 0 q0 5 -5 7 q-5 -2 -5 -7 Z" fill={C.beak} />;
      front = <Path d="M44 62 q-3 6 0 9 q3 -3 0 -9 Z" fill={C.tear} />;
      break;
    case 'sleepy':
      crest = crests.droop;
      eyes = <Path d="M42 56 h12 M66 56 h12" stroke={C.ink} strokeWidth={3.6} strokeLinecap="round" />;
      extra = (
        <>
          <SvgText x={92} y={30} fontSize={14} fontWeight="700" fill={C.zzz}>
            z
          </SvgText>
          <SvgText x={102} y={18} fontSize={18} fontWeight="700" fill={C.zzz}>
            Z
          </SvgText>
        </>
      );
      break;
    case 'oops': {
      crest = crests.messy;
      const spiral = (x: number) =>
        `M${x} 54 m-1 0 a1.5 1.5 0 1 1 3 0 a3 3 0 1 1 -6 0 a4.5 4.5 0 1 1 9 0 a6 6 0 1 1 -12 0`;
      eyes = (
        <>
          <Path d={spiral(48)} stroke={C.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
          <Path d={spiral(72)} stroke={C.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      );
      mouth = (
        <>
          <Path d="M55 62 q5 -3 10 0 q-1 5 -5 6 q-4 -1 -5 -6 Z" fill={C.beak} />
          <Path d="M56 71 q2 -2 4 0 q2 2 4 0" stroke={C.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      );
      extra = <Path d="M92 32 q-4 7 0 10 q4 -3 0 -10 Z" fill={C.tear} />;
      break;
    }
    case 'cool':
      eyes = (
        <>
          <Path
            d="M36 50 h48 v3 c0 8 -4 12 -12 12 c-7 0 -10 -5 -10 -9 h-4 c0 4 -3 9 -10 9 c-8 0 -12 -4 -12 -12 Z"
            fill={C.ink}
          />
          <Path d="M40 53 l6 0" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
        </>
      );
      mouth = <Path d="M55 64 q5 -3 10 -1 q0 6 -6 7 q-4 -2 -4 -6 Z" fill={C.beak} />;
      break;
  }
  return { crest, wings, eyes, mouth, cheekR, front, extra };
}

export function Mascot({ mood = 'happy', size = 120 }: { mood?: MascotMood; size?: number }) {
  const p = parts(mood);
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" style={{ overflow: 'visible' }}>
      <Ellipse cx={60} cy={114} rx={30} ry={4.5} fill="#00000014" />
      {p.crest}
      <Path d="M52 108 l-2 7 M58 109 l0 7 M62 109 l0 7 M68 108 l2 7" stroke={C.feet} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={60} cy={66} r={44} fill={C.body} />
      {p.wings}
      <Ellipse cx={60} cy={58} rx={31} ry={25} fill={C.face} />
      <Circle cx={37} cy={66} r={p.cheekR} fill={C.cheek} />
      <Circle cx={83} cy={66} r={p.cheekR} fill={C.cheek} />
      {p.eyes}
      {p.mouth}
      {p.front}
      {p.extra}
    </Svg>
  );
}
