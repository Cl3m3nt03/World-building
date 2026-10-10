import { Pause, Play, Square, Timer } from "lucide-react";
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  clock,
  DURATIONS,
  left,
  MAX_MINUTES,
  pause,
  resume,
  type Session,
  start,
  tick,
} from "./session";

/**
 * The focus timer (docs/features/08-quill.md): a writing session of a chosen
 * length, counted down quietly next to the words, paused, resumed or
 * stopped; at its end, the words written during it are said. The session is
 * held by the writing space so that it goes on from one chapter to another;
 * `words` are the story's.
 */
export function FocusTimer({
  words,
  session,
  setSession,
}: {
  words: number;
  session: Session | null;
  setSession: Dispatch<SetStateAction<Session | null>>;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState("30");
  const minutesId = useId();
  const wordsRef = useRef(words);
  wordsRef.current = words;

  // A beat a second while a session runs.
  useEffect(() => {
    if (session?.state !== "running") return;
    setSession((current) => (current ? tick(current, wordsRef.current, Date.now()) : current));
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      setSession((current) => (current ? tick(current, wordsRef.current, time) : current));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session?.state, setSession]);

  const begin = (value: number) => {
    const time = Date.now();
    setNow(time);
    setSession(start(value, words, time));
    setOpen(false);
  };
  const custom = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(minutes);
    if (Number.isFinite(value) && value >= 1) begin(Math.min(value, MAX_MINUTES));
  };

  if (session && session.state !== "over") {
    const running = session.state === "running";
    return (
      <span className="flex items-center gap-1">
        <span
          role="timer"
          aria-label={t("quill.timer.left", { time: clock(left(session, now)) })}
          className="tabular-nums"
        >
          {clock(left(session, now))}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t(running ? "quill.timer.pause" : "quill.timer.resume")}
          onClick={() => {
            const time = Date.now();
            setNow(time);
            setSession(running ? pause(session, time) : resume(session, time));
          }}
        >
          {running ? <Pause /> : <Play />}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("quill.timer.stop")}
          onClick={() => setSession(null)}
        >
          <Square />
        </Button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {session?.state === "over" && (
        <span role="status" className="text-primary">
          {t("quill.timer.over", { count: session.written })}
        </span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="xs">
            <Timer />
            {t("quill.timer.open")}
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" className="flex w-64 flex-col gap-3 p-3">
          <p className="text-sm font-medium">{t("quill.timer.title")}</p>
          <div className="grid grid-cols-4 gap-1">
            {DURATIONS.map((value) => (
              <Button key={value} variant="secondary" size="sm" onClick={() => begin(value)}>
                {t("quill.timer.minutes", { count: value })}
              </Button>
            ))}
          </div>
          <form onSubmit={custom} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor={minutesId} className="text-xs text-muted-foreground">
                {t("quill.timer.custom")}
              </label>
              <Input
                id={minutesId}
                type="number"
                min={1}
                max={MAX_MINUTES}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </div>
            <Button type="submit" size="sm">
              {t("quill.timer.start")}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </span>
  );
}
