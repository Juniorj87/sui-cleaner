import React from "react";

export function SuiScene({ compact = false, success = false }: { compact?: boolean; success?: boolean }) {
  return (
    <div className={"scene " + (compact ? "scene-compact" : "") + (success ? " scene-success" : "")}>
      <div className="stars">
        {Array.from({ length: 26 }).map((_, i) => (
          <i
            key={i}
            style={
              {
                "--x": `${(i * 37) % 97}%`,
                "--y": `${(i * 53) % 76}%`,
                "--d": `${1 + (i % 4) * 0.7}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="island island-a">
        <span />
        <b />
        <b />
        <b />
      </div>
      <div className="island island-b">
        <span />
        <b />
        <b />
      </div>
      <div className="island island-c">
        <span />
        <b />
        <b />
        <b />
      </div>
      <div className="tower tower-a">
        <em />
        <i />
        <i />
      </div>
      <div className="tower tower-b">
        <em />
        <i />
        <i />
      </div>
      <div className="portal">
        <div className="portal-ring ring-1" />
        <div className="portal-ring ring-2" />
        <div className="portal-ring ring-3" />
        <div className="portal-core">
          <svg viewBox="0 0 100 120" aria-hidden="true">
            <path
              d="M50 8C45 25 24 43 24 67c0 23 15 40 26 40s26-17 26-40C76 43 55 25 50 8Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
            />
            <path d="M40 83c8 7 20 7 28 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <div className="portal-stand">
          <div />
        </div>
      </div>
      <div className="rocks">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="mascot">
        <div className="head">
          <i />
          <i />
          <b />
        </div>
        <div className="body">
          <span />
        </div>
        <div className="mop">
          <b />
          <i />
        </div>
      </div>
    </div>
  );
}

export function MiniScene({ success = false }: { success?: boolean }) {
  return <SuiScene compact success={success} />;
}
