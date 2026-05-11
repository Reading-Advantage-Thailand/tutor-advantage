"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMapping = exports.createMapping = exports.getMappings = exports.getUnresolvedLinks = exports.resolveException = exports.getExceptions = void 0;
// Mock Data
const MOCK_EXCEPTIONS = [
    {
        id: "evt_3923nf92301",
        type: "WEBHOOK_FAILED",
        studentName: "Somchai J.",
        classId: "cls_abc123",
        provider: "OMISE / PROMPTPAY",
        amount: "2500 THB",
        status: "UNRESOLVED",
        createdAt: "2026-03-04T10:15:00Z",
        errorDetail: "Timeout waiting for learning-service to activate enrollment",
    },
    {
        id: "evt_1a9sd8f7a9s",
        type: "ENROLLMENT_MISMATCH",
        studentName: "Nong M.",
        classId: "cls_xyz987",
        provider: "OMISE / CARD",
        amount: "2500 THB",
        status: "UNRESOLVED",
        createdAt: "2026-03-04T08:30:22Z",
        errorDetail: "Payment succeeded but class was full. Payment held.",
    },
];
const UNRESOLVED_LINKS = [
    {
        url: "domain.com/student/read/origin-v1-bonus",
        hits: 1240,
        lastSeen: "2026-03-04T09:30:00Z",
    },
    {
        url: "domain.com/student/read/quest-special-evt",
        hits: 856,
        lastSeen: "2026-03-03T18:15:00Z",
    },
    {
        url: "domain.com/student/read/legacy-test-1",
        hits: 42,
        lastSeen: "2026-03-01T10:00:00Z",
    },
];
let ACTIVE_MAPPINGS = [
    {
        id: "map_1",
        source: "domain.com/student/read/origins-book-1-intro",
        target: "/articles/lvl1-intro",
        created: "2026-02-28",
    },
    {
        id: "map_2",
        source: "domain.com/student/read/quest-4-chapter1",
        target: "/articles/lvl4-ch1",
        created: "2026-02-28",
    },
];
// Exceptions
const getExceptions = async (req, res) => {
    res.status(200).json({ exceptions: MOCK_EXCEPTIONS });
};
exports.getExceptions = getExceptions;
const resolveException = async (req, res) => {
    const { id, action } = req.params;
    res
        .status(200)
        .json({
        success: true,
        message: `Action ${action} applied to exception ${id}`,
    });
};
exports.resolveException = resolveException;
// Legacy Links
const getUnresolvedLinks = async (req, res) => {
    res.status(200).json({ links: UNRESOLVED_LINKS });
};
exports.getUnresolvedLinks = getUnresolvedLinks;
const getMappings = async (req, res) => {
    res.status(200).json({ mappings: ACTIVE_MAPPINGS });
};
exports.getMappings = getMappings;
const createMapping = async (req, res) => {
    const { source, target } = req.body;
    const newMap = {
        id: `map_${Date.now()}`,
        source,
        target,
        created: new Date().toISOString().split("T")[0],
    };
    ACTIVE_MAPPINGS.push(newMap);
    res.status(201).json({ success: true, mapping: newMap });
};
exports.createMapping = createMapping;
const deleteMapping = async (req, res) => {
    const { id } = req.params;
    ACTIVE_MAPPINGS = ACTIVE_MAPPINGS.filter((m) => m.id !== id);
    res.status(200).json({ success: true, message: "Mapping deleted" });
};
exports.deleteMapping = deleteMapping;
