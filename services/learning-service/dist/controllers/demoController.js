"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDemoLessonCatalog = getDemoLessonCatalog;
const demoLessons_1 = require("../services/demoLessons");
// Lists the fixed free demo lessons (one per level) for the tutor demo picker.
async function getDemoLessonCatalog(_req, res) {
    return res.status(200).json({ lessons: (0, demoLessons_1.getDemoLessons)() });
}
