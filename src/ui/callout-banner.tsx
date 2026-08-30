import { ReactNode } from "react";
import { cn } from "./class-names";
import styles from "./callout-banner.module.scss";

type CalloutBannerTone = "accent" | "review";

type CalloutBannerProps = {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  title: string;
  tone?: CalloutBannerTone;
};

export function CalloutBanner({
  action,
  children,
  className,
  title,
  tone = "accent",
}: CalloutBannerProps) {
  return (
    <section
      className={cn(
        styles.banner,
        styles[`banner--${tone}`],
        className,
      )}
    >
      <div className={styles.copy}>
        <h2>{title}</h2>
        {children ? <p>{children}</p> : null}
      </div>
      {action ? <div className={styles.actions}>{action}</div> : null}
    </section>
  );
}
