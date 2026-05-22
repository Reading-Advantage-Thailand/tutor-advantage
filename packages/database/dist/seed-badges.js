"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function seedBadges() {
    console.log("🔍 Finding all active tutors...");
    const tutors = await prisma.user.findMany({
        where: { role: "TUTOR" }
    });
    console.log(`✅ Found ${tutors.length} tutors.`);
    for (const tutor of tutors) {
        console.log(`🏅 Granting badges to ${tutor.displayName || tutor.email || tutor.userId}...`);
        // Badge 1: RISING_STAR
        try {
            await prisma.tutorBadge.upsert({
                where: {
                    tutorUserId_badgeCode: {
                        tutorUserId: tutor.userId,
                        badgeCode: "RISING_STAR"
                    }
                },
                update: {},
                create: {
                    tutorUserId: tutor.userId,
                    badgeCode: "RISING_STAR",
                    unlockedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
                }
            });
            console.log("   - RISING_STAR added.");
        }
        catch (err) {
            console.error("   - Could not add RISING_STAR", err);
        }
        // Badge 2: FAST_RESPONDER
        try {
            await prisma.tutorBadge.upsert({
                where: {
                    tutorUserId_badgeCode: {
                        tutorUserId: tutor.userId,
                        badgeCode: "FAST_RESPONDER"
                    }
                },
                update: {},
                create: {
                    tutorUserId: tutor.userId,
                    badgeCode: "FAST_RESPONDER",
                    unlockedAt: new Date()
                }
            });
            console.log("   - FAST_RESPONDER added.");
        }
        catch (err) {
            console.error("   - Could not add FAST_RESPONDER", err);
        }
    }
    console.log("✨ All badge injection complete.");
}
seedBadges()
    .catch(e => {
    console.error("Execution failed:", e);
})
    .finally(async () => {
    await prisma.$disconnect();
});
