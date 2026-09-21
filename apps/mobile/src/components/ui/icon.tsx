import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

// Stroke icons on a 24px grid (same set as the design's UI kit).
const ICONS = {
  back: <Path d="M15 5l-7 7 7 7" />,
  chevron: <Path d="M9 5l7 7-7 7" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  phone: (
    <>
      <Rect x={7} y={2.5} width={10} height={19} rx={2.5} />
      <Path d="M11 18.5h2" />
    </>
  ),
  mail: (
    <>
      <Rect x={3} y={5} width={18} height={14} rx={3} />
      <Path d="M4 7l8 6 8-6" />
    </>
  ),
  lock: (
    <>
      <Rect x={5} y={10.5} width={14} height={10} rx={2.5} />
      <Path d="M8 10.5V8a4 4 0 018 0v2.5" />
    </>
  ),
  eye: (
    <>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  bell: (
    <>
      <Path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z" />
      <Path d="M10 21h4" />
    </>
  ),
  users: (
    <>
      <Circle cx={9} cy={8.5} r={3.5} />
      <Path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
      <Circle cx={17} cy={9} r={2.8} />
      <Path d="M16.5 14.6c2.6.2 4.4 2 5 5" />
    </>
  ),
  calendar: (
    <>
      <Rect x={3.5} y={5} width={17} height={15.5} rx={3} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  camera: (
    <>
      <Path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3v10.5H4z" />
      <Circle cx={12} cy={13.5} r={3.3} />
    </>
  ),
  laptop: (
    <>
      <Rect x={5} y={5} width={14} height={10} rx={1.8} />
      <Path d="M2.5 19h19" />
    </>
  ),
  edit: (
    <>
      <Path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" />
      <Path d="M14.5 6.5 17.5 9.5" />
    </>
  ),
  globe: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M3 12h18" />
      <Path d="M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3Z" />
    </>
  ),
  key: (
    <>
      <Circle cx={8} cy={15} r={4} />
      <Path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5" />
    </>
  ),
  shield: (
    <>
      <Path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.3-7.5 9.5-4.3-1.2-7.5-5-7.5-9.5V6z" />
      <Path d="M8.8 12l2.3 2.3 4.2-4.3" />
    </>
  ),
  sparkle: <Path d="M12 3.5l1.9 5.2 5.1 1.8-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.8z" />,
  heart: <Path d="M12 20s-7-4.4-7-9.4A4 4 0 0112 8.2 4 4 0 0119 10.6c0 5-7 9.4-7 9.4z" />,
  bubble: <Path d="M20 11.5a6.5 6.5 0 01-6.5 6.5H9l-4 3v-4.3A6.5 6.5 0 019.5 5h4a6.5 6.5 0 016.5 6.5z" />,
  search: (
    <>
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="M16 16l4.5 4.5" />
    </>
  ),
  map: (
    <>
      <Path d="M9 4.5L3.5 7v12.5L9 17l6 2.5 5.5-2.5V4.5L15 7 9 4.5z" />
      <Path d="M9 4.5V17M15 7v12.5" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" />
      <Circle cx={12} cy={10} r={2.6} />
    </>
  ),
  feed: (
    <>
      <Rect x={3.5} y={4.5} width={17} height={15} rx={3} />
      <Path d="M7.5 9h9M7.5 13h6" />
    </>
  ),
  person: (
    <>
      <Circle cx={12} cy={8.5} r={3.8} />
      <Path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" />
    </>
  ),
  pet: (
    <>
      <Circle cx={12} cy={13} r={6.5} />
      <Path d="M8 6.5C8 4.6 9 3.5 10 3.5s2 1.1 2 3M16 6.5c0-1.9-1-3-2-3" />
    </>
  ),
  logout: (
    <>
      <Path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" />
      <Path d="M9 16l-4-4 4-4M5 12h11" />
    </>
  ),
  shuffle: (
    <>
      <Path d="M3 7h3.5c4 0 5.5 10 10 10H21" />
      <Path d="M3 17h3.5c1.8 0 3-2 4.2-4.2M13.3 9.2C14.5 7.6 15.6 7 17 7h4" />
      <Path d="M18 4l3 3-3 3M18 14l3 3-3 3" />
    </>
  ),
  flies: <Path d="M3 13c3-1 5-4 9-4s6 3 9 4M7 13c1 2 3 3 5 3s4-1 5-3" />,
  hops: <Path d="M4 18c2-6 5-9 8-9s6 3 8 9" />,
  trots: <Path d="M5 16l3-4 3 2 3-5 5 7" />,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  color,
  strokeWidth = 2.2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const theme = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? theme.text}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      {ICONS[name]}
    </Svg>
  );
}

export function GoogleLogo({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
      <Path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0012 22z" />
      <Path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1A10 10 0 002 12c0 1.6.4 3.1 1.1 4.6z" />
      <Path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 003.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" />
    </Svg>
  );
}

export function AppleLogo({ size = 22, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? theme.text}>
      <Path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8-.7 0-1.9-.8-3.1-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3.1.7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.7zM14.1 5.8c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z" />
    </Svg>
  );
}
