const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};

function Die({ value }: { value: number }) {
  const pips = PIP_LAYOUTS[value] ?? [];
  return (
    <div className="w-10 h-10 bg-white rounded-lg border-2 border-haat-ink grid grid-cols-3 grid-rows-3 gap-0.5 p-1 shadow">
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const has = pips.some(([pr, pc]) => pr === r && pc === c);
        return (
          <div key={i} className="flex items-center justify-center">
            {has && <div className="w-1.5 h-1.5 rounded-full bg-haat-ink" />}
          </div>
        );
      })}
    </div>
  );
}

export default function Dice({ values, rolling }: { values: [number, number]; rolling?: boolean }) {
  return (
    <div className={`flex gap-2 justify-center ${rolling ? "animate-pulse" : ""}`}>
      <Die value={values[0]} />
      <Die value={values[1]} />
    </div>
  );
}
