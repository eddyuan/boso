import type { PetSpecies } from '@bsocial/shared';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { Mascot } from './mascot';

// 2D art for the three companions (design/app-ui, Create pet). Each species
// also has a 3D model for the map.

const INK = '#2B1F16';

export function Bunny({ size = 120 }: { size?: number }) {
  const c = { body: '#E9C9A1', deep: '#D6AE7F', belly: '#FFF4E3', inner: '#FFB8C6', cheek: '#FF9AAE', feet: '#F4D9BD' };
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" style={{ overflow: 'visible' }}>
      <Ellipse cx={60} cy={114} rx={30} ry={4.5} fill="#00000014" />
      <Path d="M40 36 C30 6 36 -8 46 -6 C56 -4 56 14 52 34 Z" fill={c.body} />
      <Path d="M42 30 C36 8 40 -2 46 -1 C51 0 52 12 49 30 Z" fill={c.inner} />
      <Path d="M80 36 C92 10 94 -4 84 -6 C72 -6 68 12 68 34 Z" fill={c.body} />
      <Path d="M78 30 C86 12 88 2 83 0 C76 0 73 12 72 30 Z" fill={c.inner} />
      <Ellipse cx={46} cy={110} rx={11} ry={6} fill={c.feet} />
      <Ellipse cx={74} cy={110} rx={11} ry={6} fill={c.feet} />
      <Circle cx={60} cy={68} r={43} fill={c.body} />
      <Ellipse cx={60} cy={84} rx={26} ry={22} fill={c.belly} />
      <Ellipse cx={22} cy={88} rx={8} ry={11} fill={c.deep} />
      <Ellipse cx={98} cy={88} rx={8} ry={11} fill={c.deep} />
      <Circle cx={38} cy={70} r={8} fill={c.cheek} opacity={0.8} />
      <Circle cx={82} cy={70} r={8} fill={c.cheek} opacity={0.8} />
      <Circle cx={47} cy={58} r={6} fill={INK} />
      <Circle cx={73} cy={58} r={6} fill={INK} />
      <Circle cx={49} cy={56} r={2} fill="#FFFFFF" />
      <Circle cx={75} cy={56} r={2} fill="#FFFFFF" />
      <Path d="M56 66 q4 3 8 0 q-1 4 -4 5 q-3 -1 -4 -5 Z" fill="#E8798F" />
      <Path d="M60 71 v4 M60 75 q-4 4 -8 1 M60 75 q4 4 8 1" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function Cat({ size = 120 }: { size?: number }) {
  const c = { body: '#A9B3C4', deep: '#8C97AA', muzzle: '#F4F1EC', inner: '#FFB8C6', cheek: '#FF9AAE', stripe: '#7F8A9D' };
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" style={{ overflow: 'visible' }}>
      <Ellipse cx={60} cy={114} rx={30} ry={4.5} fill="#00000014" />
      <Path d="M96 92 C116 88 118 64 106 58 C112 72 106 84 92 86 Z" fill={c.deep} />
      <Path d="M24 44 L22 14 L48 30 Z" fill={c.body} />
      <Path d="M28 38 L27 21 L42 31 Z" fill={c.inner} />
      <Path d="M96 44 L98 14 L72 30 Z" fill={c.body} />
      <Path d="M92 38 L93 21 L78 31 Z" fill={c.inner} />
      <Ellipse cx={46} cy={110} rx={10} ry={6} fill={c.muzzle} />
      <Ellipse cx={74} cy={110} rx={10} ry={6} fill={c.muzzle} />
      <Circle cx={60} cy={68} r={43} fill={c.body} />
      <Path d="M50 26 q10 4 20 0 M52 34 q8 3 16 0" stroke={c.stripe} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <Path
        d="M19 66 q7 -2 12 2 M18 76 q7 -2 12 2 M101 66 q-7 -2 -12 2 M102 76 q-7 -2 -12 2"
        stroke={c.stripe}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <Ellipse cx={60} cy={78} rx={22} ry={16} fill={c.muzzle} />
      <Ellipse cx={60} cy={96} rx={20} ry={12} fill={c.muzzle} />
      <Circle cx={36} cy={72} r={7.5} fill={c.cheek} opacity={0.75} />
      <Circle cx={84} cy={72} r={7.5} fill={c.cheek} opacity={0.75} />
      <Ellipse cx={46} cy={60} rx={6} ry={7} fill={INK} />
      <Ellipse cx={74} cy={60} rx={6} ry={7} fill={INK} />
      <Circle cx={48} cy={57} r={2.2} fill="#FFFFFF" />
      <Circle cx={76} cy={57} r={2.2} fill="#FFFFFF" />
      <Path d="M56 70 L64 70 L60 75 Z" fill="#E8798F" />
      <Path d="M60 75 q-4 5 -9 2 M60 75 q4 5 9 2" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Path
        d="M40 78 l-14 -2 M40 82 l-13 3 M80 78 l14 -2 M80 82 l13 3"
        stroke={INK}
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.45}
      />
    </Svg>
  );
}

export function Egg({ size = 120, cracked = false }: { size?: number; cracked?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" style={{ overflow: 'visible' }}>
      <Ellipse cx={60} cy={113} rx={30} ry={5} fill="#00000016" />
      <Path
        d="M60 8 C88 8 104 50 104 72 C104 96 84 110 60 110 C36 110 16 96 16 72 C16 50 32 8 60 8 Z"
        fill="#FFF3CC"
        stroke="#EFC96A"
        strokeWidth={2.5}
      />
      <Path
        d="M60 8 C88 8 104 50 104 72 C104 96 84 110 60 110 C82 100 92 82 90 62 C88 38 76 14 60 8 Z"
        fill="#FFE39A"
        opacity={0.7}
      />
      <Ellipse cx={44} cy={40} rx={7} ry={9} fill="#FFC53D" />
      <Ellipse cx={74} cy={56} rx={9} ry={7} fill="#FFC53D" />
      <Ellipse cx={46} cy={84} rx={8} ry={6} fill="#FF8A4C" opacity={0.8} />
      <Ellipse cx={80} cy={88} rx={5} ry={6} fill="#FFC53D" />
      <Ellipse cx={38} cy={30} rx={6} ry={12} fill="#FFFFFF" opacity={0.5} transform="rotate(-20 38 30)" />
      {cracked && (
        <Path
          d="M30 58 l10 8 l8 -10 l9 12 l9 -11 l8 10 l10 -8"
          stroke="#8A5A00"
          strokeWidth={3}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

/** Matches the 3D puppy: cream ball, brown floppy ears, tan patch over one eye. */
export function Puppy({ size = 120 }: { size?: number }) {
  const c = { body: '#F6EDDF', patch: '#EBD7B6', ear: '#A9703F', earDeep: '#8E5C32', cheek: '#E8734D', nose: '#7A4A2B' };
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" style={{ overflow: 'visible' }}>
      <Ellipse cx={60} cy={114} rx={30} ry={4.5} fill="#00000014" />
      <Ellipse cx={44} cy={110} rx={9} ry={6} fill={c.ear} />
      <Ellipse cx={76} cy={110} rx={9} ry={6} fill={c.ear} />
      <Circle cx={60} cy={68} r={43} fill={c.body} />
      <Path d="M78 30 a30 30 0 0 1 22 34 a34 34 0 0 0 -26 -30 Z" fill={c.patch} />
      <Path d="M22 38 q-12 16 -2 32 q12 8 18 -8 q-8 -14 -16 -24 Z" fill={c.ear} />
      <Path d="M98 38 q12 16 2 32 q-12 8 -18 -8 q8 -14 16 -24 Z" fill={c.earDeep} />
      <Circle cx={36} cy={80} r={8} fill={c.cheek} opacity={0.8} />
      <Circle cx={84} cy={80} r={8} fill={c.cheek} opacity={0.8} />
      <Ellipse cx={47} cy={66} rx={7} ry={8} fill={INK} />
      <Ellipse cx={73} cy={66} rx={7} ry={8} fill={INK} />
      <Circle cx={49.5} cy={63} r={2.4} fill="#FFFFFF" />
      <Circle cx={75.5} cy={63} r={2.4} fill="#FFFFFF" />
      <Ellipse cx={60} cy={80} rx={6} ry={4.5} fill={c.nose} />
      <Path d="M60 85 q-5 6 -10 2 M60 85 q5 6 10 2" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function CompanionArt({ species, size = 120 }: { species: PetSpecies | string; size?: number }) {
  if (species === 'bunny') return <Bunny size={size} />;
  if (species === 'cat') return <Cat size={size} />;
  if (species === 'puppy') return <Puppy size={size} />;
  return <Mascot mood="happy" size={size} />;
}
