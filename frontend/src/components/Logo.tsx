/** Logo del mockup: píldora "KOLBEN" azul petróleo + barras turquesa y naranja. */
export default function Logo({ barras = true }: { barras?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center rounded-[10px] bg-kolben-ink px-[22px] py-[9px] text-[13px] font-bold tracking-[0.2em] text-white">
        KOLBEN
      </span>
      {barras && (
        <span className="flex items-center gap-[7px]" aria-hidden="true">
          <span className="h-[24px] w-[3px] rounded-full bg-kolben-teal" />
          <span className="h-[24px] w-[13px] rounded-[3px] bg-kolben-orange" />
        </span>
      )}
    </div>
  );
}
