import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import { computeRateGoal, computeWalletBreakdown, type FinanceSummary } from "./home-data";
import { HomeWallet } from "./HomeWallet";
import { buildHomeSchedule, type HomeClass } from "./home-schedule";
import { NextClass } from "./NextClass";
import { RecentClasses } from "./RecentClasses";
import { TodaySessions } from "./TodaySessions";
import { WeekGrid } from "./WeekGrid";

const NOW = new Date("2026-11-09T10:00:00+07:00");
const emptySchedule = buildHomeSchedule(null, NOW);
const someClass = { id: "c1", name: "English" } as HomeClass;

describe("Home blocks when their data failed to load", () => {
  it("NextClass says the schedule failed (with a retry) instead of 'no next class'", () => {
    const html = renderToStaticMarkup(<NextClass next={null} hasClasses={false} unavailable />);
    expect(html).toContain(t("dashboardHome.scheduleUnavailable"));
    expect(html).toContain(t("shell.retry"));
    expect(html).not.toContain(t("dashboardHome.noNextClass"));
    expect(html).not.toContain(t("dashboardHome.createSchedule"));
  });

  it("NextClass keeps the empty card when the class list loaded", () => {
    const html = renderToStaticMarkup(<NextClass next={null} hasClasses />);
    expect(html).toContain(t("dashboardHome.noNextClass"));
    expect(html).not.toContain(t("dashboardHome.scheduleUnavailable"));
  });

  it("TodaySessions and WeekGrid show the cause, not an empty day/week", () => {
    const today = renderToStaticMarkup(<TodaySessions schedule={emptySchedule} unavailable />);
    expect(today).toContain(t("dashboardHome.scheduleUnavailable"));
    expect(today).toContain(t("shell.retry"));
    expect(today).not.toContain(t("dashboardSchedule.emptyDay"));

    const week = renderToStaticMarkup(<WeekGrid schedule={emptySchedule} unavailable />);
    expect(week).toContain(t("dashboardHome.scheduleUnavailable"));
    expect(week).not.toContain(t("dashboardSchedule.weekEmptyTitle"));

    expect(renderToStaticMarkup(<TodaySessions schedule={emptySchedule} />)).toContain(t("dashboardSchedule.emptyDay"));
  });

  it("RecentClasses offers 'create' only when the tutor really has no classes", () => {
    const create = t("tutorClass.classes.create");
    // Summary loaded and empty: the create empty state.
    expect(renderToStaticMarkup(<RecentClasses recentClasses={[]} classes={[]} />)).toContain(create);
    // Summary failed, class list loaded empty: still truly no classes.
    expect(renderToStaticMarkup(<RecentClasses recentClasses={[]} classes={[]} summaryFailed />)).toContain(create);
    // Summary failed while classes exist or are unknown: the cause, no create action.
    for (const classes of [[someClass], null]) {
      const html = renderToStaticMarkup(<RecentClasses recentClasses={[]} classes={classes} summaryFailed />);
      expect(html).toContain(t("dashboardHome.recentClassesUnavailable"));
      expect(html).not.toContain(create);
      expect(html).not.toContain(t("dashboardHome.emptyClasses"));
    }
  });

  it("RecentClasses keeps a clamped class name's full value in title", () => {
    const name = "Local Test Class with a very long name for the narrow column";
    const html = renderToStaticMarkup(
      <RecentClasses
        recentClasses={[{ id: "c1", name, status: "open", students: 4, nextSession: "จ. 17:00" }]}
        classes={null}
      />,
    );
    expect(html).toContain(`title="${name}"`);
  });
});

describe("HomeWallet commission line", () => {
  /** Visible text of p.ds-wallet-sub (tags dropped, no-break spaces as spaces), or null when absent. */
  const sublineOf = (finance: FinanceSummary | null) => {
    const html = renderToStaticMarkup(
      <HomeWallet
        goal={computeRateGoal(finance)}
        estimatedIncome={0}
        hasFinance={finance !== null}
        breakdown={computeWalletBreakdown(finance)}
      />,
    );
    expect(html).not.toContain("{");
    const match = html.match(/<p class="ds-wallet-sub">([\s\S]*?)<\/p>/);
    if (!match) return null;
    return match[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;|&#xa0;|&#160;/gi, " ")
      .replace(/\u00a0/g, " ")
      .replace(/\u2060/g, "");
  };

  it("has no commission line when the volume split is unknown", () => {
    expect(sublineOf({ currentRate: 0.5, grossVolumeTHB: 20_000 })).toBeNull();
  });

  it("keeps the old line for a tutor without a network", () => {
    expect(
      sublineOf({ currentRate: 0.5, grossVolumeTHB: 8_450, personalVolumeTHB: 8_450, networkBonusTHB: 0 }),
    ).toBe("คอมมิชชัน 50% จากยอดสะสม ฿8,450");
  });

  it("names own sales and the network bonus when the downline sold", () => {
    expect(
      sublineOf({ currentRate: 0.5, grossVolumeTHB: 20_000, personalVolumeTHB: 5_000, networkBonusTHB: 375 }),
    ).toBe("คอมมิชชัน 50% จากยอดส่วนตัว ฿5,000 + โบนัสเครือข่าย ฿375");
  });
});
