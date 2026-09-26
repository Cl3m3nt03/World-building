type BackdropProps = {
  /** Main image of the open world. Without one, the token gradient is shown (ADR 0003). */
  imageUrl?: string;
};

export function Backdrop({ imageUrl }: BackdropProps) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 size-full scale-110 object-cover"
          style={{ filter: "blur(var(--bz-blur-backdrop))" }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "var(--bz-backdrop-gradient)" }} />
      )}
      <div className="absolute inset-0" style={{ background: "var(--bz-backdrop-overlay)" }} />
    </div>
  );
}
