// Roseta de líneas finas al estilo de los billetes y cheques (impresión de seguridad).
export function Guilloche({ className }) {
  const rings = [];
  for (let r = 0; r < 3; r += 1) {
    const petals = 36 + r * 12;
    const radius = 170 - r * 46;
    for (let i = 0; i < petals; i += 1) {
      rings.push(
        <ellipse
          key={`${r}-${i}`}
          cx="0"
          cy="0"
          rx={radius}
          ry={radius * 0.34}
          transform={`rotate(${(360 / petals) * i})`}
        />,
      );
    }
  }
  return (
    <svg className={className} viewBox="-200 -200 400 400" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="0.45">{rings}</g>
      <circle r="190" fill="none" stroke="currentColor" strokeWidth="0.6" />
      <circle r="196" fill="none" stroke="currentColor" strokeWidth="0.3" />
    </svg>
  );
}
