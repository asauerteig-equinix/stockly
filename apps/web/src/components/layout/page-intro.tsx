type PageIntroProps = {
  title: string;
  description: string;
  eyebrow?: string;
};

export function PageIntro({ title, description, eyebrow }: PageIntroProps) {
  return (
    <div className="space-y-3 border-b border-slate-200 pb-4">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
      ) : null}
      <div className="space-y-2 lg:space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="max-w-4xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}
