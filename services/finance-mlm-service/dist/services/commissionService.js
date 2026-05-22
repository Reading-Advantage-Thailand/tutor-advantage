"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIctMonthWindow = getIctMonthWindow;
exports.formatIctPeriodMonth = formatIctPeriodMonth;
exports.calculateCommissionRate = calculateCommissionRate;
exports.calculateCommissionInfo = calculateCommissionInfo;
exports.calculatePayoutMinor = calculatePayoutMinor;
const RATE_SCALE = 1000000000n;
function getIctMonthWindow(periodMonth) {
    const [yearText, monthText] = periodMonth.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isInteger(year) ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12) {
        throw new Error("INVALID_PERIOD_MONTH");
    }
    return {
        start: new Date(Date.UTC(year, month - 1, 1, -7, 0, 0, 0)),
        end: new Date(Date.UTC(year, month, 1, -7, 0, 0, 0) - 1),
    };
}
function formatIctPeriodMonth(date = new Date()) {
    const ictDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return `${ictDate.getUTCFullYear()}-${String(ictDate.getUTCMonth() + 1).padStart(2, "0")}`;
}
function calculateCommissionRate(volumeTHB) {
    const baseRate = Number(process.env.COMMISSION_BASE_RATE || "0.5");
    if (!Number.isFinite(volumeTHB) || volumeTHB <= 0) {
        return 0;
    }
    if (volumeTHB >= 20000) {
        return ((baseRate *
            (1 - Math.pow(0.3, 1 + Math.log(volumeTHB / 20000) / Math.log(5)))) /
            0.7);
    }
    return 0.4 + volumeTHB / 200000;
}
function calculateCommissionInfo(volumeTHB) {
    let nextTarget = 20000;
    if (volumeTHB >= 20000 && volumeTHB < 100000)
        nextTarget = 100000;
    else if (volumeTHB >= 100000 && volumeTHB < 500000)
        nextTarget = 500000;
    else if (volumeTHB >= 500000)
        nextTarget = 0;
    return {
        rate: calculateCommissionRate(volumeTHB),
        nextTarget,
    };
}
function calculatePayoutMinor(volumeMinor, rate) {
    if (volumeMinor <= 0n || rate <= 0)
        return 0n;
    const scaledRate = BigInt(Math.round(rate * Number(RATE_SCALE)));
    return (volumeMinor * scaledRate) / RATE_SCALE;
}
