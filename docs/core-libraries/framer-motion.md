# Framer Motion Documentation

## Overview

Framer Motion is our animation library for creating smooth, interactive animations in the Tutor Advantage platform. This document outlines our animation standards, common patterns, and best practices.

## Animation Standards

### 1. Motion Values

```typescript
// constants/motion.ts
export const motionConfig = {
  // Transition presets
  transitions: {
    ease: [0.6, 0.01, -0.05, 0.9],
    spring: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
    },
    springStiff: {
      type: 'spring',
      stiffness: 600,
      damping: 35,
    },
  },

  // Duration presets
  duration: {
    fast: 0.2,
    normal: 0.4,
    slow: 0.6,
  },

  // Common variants
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },

  slideUp: {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
  },
};
```

## Implementation Patterns

### 1. Page Transitions

```typescript
// components/PageTransition.tsx
import { motion } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        duration: 0.4,
        ease: [0.6, 0.01, -0.05, 0.9],
      }}
    >
      {children}
    </motion.div>
  );
}

// Usage in pages
export default function CoursePage() {
  return (
    <PageTransition>
      <div className="course-content">{/* Page content */}</div>
    </PageTransition>
  );
}
```

### 2. Component Animations

```typescript
// components/AnimatedCard.tsx
import { motion } from "framer-motion";

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
}

export function AnimatedCard({ children, delay = 0 }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.6, 0.01, -0.05, 0.9],
      }}
      whileHover={{
        scale: 1.02,
        transition: { duration: 0.2 },
      }}
      className="rounded-lg bg-white shadow-md p-6"
    >
      {children}
    </motion.div>
  );
}
```

### 3. List Animations

```typescript
// components/AnimatedList.tsx
import { motion } from "framer-motion";

interface AnimatedListProps {
  items: any[];
}

export function AnimatedList({ items }: AnimatedListProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.ul
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {items.map((item, index) => (
        <motion.li
          key={index}
          variants={item}
          className="bg-white rounded-lg p-4"
        >
          {item.content}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

### 4. Loading States

```typescript
// components/LoadingSpinner.tsx
import { motion } from "framer-motion";

export function LoadingSpinner() {
  return (
    <motion.div
      className="w-8 h-8 border-4 border-primary rounded-full"
      style={{ borderTopColor: "transparent" }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        ease: "linear",
        repeat: Infinity,
      }}
    />
  );
}
```

## Advanced Patterns

### 1. Gesture Animations

```typescript
// components/DraggableCard.tsx
import { motion, useMotionValue, useTransform } from "framer-motion";

export function DraggableCard() {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: -200, right: 200 }}
      style={{ x, rotate, opacity }}
      className="w-64 h-96 bg-white rounded-xl shadow-lg"
    >
      {/* Card content */}
    </motion.div>
  );
}
```

### 2. Scroll-Based Animations

```typescript
// components/ScrollAnimations.tsx
import { motion, useScroll, useTransform } from "framer-motion";

export function ScrollAnimations() {
  const { scrollYProgress } = useScroll();
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]);

  return (
    <motion.div
      style={{ scale, opacity }}
      className="h-screen flex items-center justify-center"
    >
      <h1 className="text-4xl font-bold">Scroll to animate</h1>
    </motion.div>
  );
}
```

### 3. Path Animations

```typescript
// components/AnimatedLogo.tsx
import { motion } from "framer-motion";

export function AnimatedLogo() {
  const pathVariants = {
    hidden: {
      pathLength: 0,
      opacity: 0,
    },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        duration: 2,
        ease: "easeInOut",
      },
    },
  };

  return (
    <motion.svg
      width="100"
      height="100"
      viewBox="0 0 100 100"
      initial="hidden"
      animate="visible"
    >
      <motion.path
        d="M10 10 L90 90"
        stroke="currentColor"
        strokeWidth="2"
        variants={pathVariants}
      />
    </motion.svg>
  );
}
```

## Performance Optimization

### 1. Layout Animations

```typescript
// components/LayoutAnimation.tsx
import { motion, LayoutGroup } from "framer-motion";

export function LayoutAnimation() {
  return (
    <LayoutGroup>
      <motion.div
        layout
        transition={{
          layout: { duration: 0.3 },
        }}
        className="grid grid-cols-2 gap-4"
      >
        {/* Content that changes layout */}
      </motion.div>
    </LayoutGroup>
  );
}
```

### 2. Optimized Animations

```typescript
// components/OptimizedAnimation.tsx
import { motion, useReducedMotion } from "framer-motion";

export function OptimizedAnimation() {
  const shouldReduceMotion = useReducedMotion();

  const variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      transition={{
        duration: shouldReduceMotion ? 0.1 : 0.4,
      }}
    >
      {/* Content */}
    </motion.div>
  );
}
```

## Accessibility

### 1. Reduced Motion

```typescript
// hooks/useAnimationConfig.ts
import { useReducedMotion } from 'framer-motion';

export function useAnimationConfig() {
  const shouldReduceMotion = useReducedMotion();

  return {
    transition: {
      duration: shouldReduceMotion ? 0 : 0.4,
      ease: [0.6, 0.01, -0.05, 0.9],
    },
    variants: {
      initial: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: shouldReduceMotion ? 0 : -20 },
    },
  };
}
```

### 2. Focus Management

```typescript
// components/AnimatedModal.tsx
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

export function AnimatedModal({ isOpen, onClose }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <motion.div
      ref={modalRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      {/* Modal content */}
    </motion.div>
  );
}
```

## Testing

### 1. Animation Testing

```typescript
// __tests__/animations.test.tsx
import { render, screen } from "@testing-library/react";
import { AnimatedCard } from "@/components/AnimatedCard";

describe("AnimatedCard", () => {
  it("renders with initial animation values", () => {
    render(<AnimatedCard>Test Content</AnimatedCard>);

    const card = screen.getByText("Test Content");
    expect(card).toHaveStyle({
      opacity: "0",
      transform: "scale(0.95) translateZ(0)",
    });
  });
});
```

## Common Animation Patterns

### 1. Modal Animations

```typescript
// components/Modal.tsx
import { motion, AnimatePresence } from "framer-motion";

export function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-x-4 top-1/2 transform -translate-y-1/2"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### 2. Navigation Animations

```typescript
// components/NavMenu.tsx
import { motion } from "framer-motion";

const menuVariants = {
  closed: {
    x: "-100%",
  },
  open: {
    x: 0,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  closed: { x: -20, opacity: 0 },
  open: { x: 0, opacity: 1 },
};

export function NavMenu({ isOpen }) {
  return (
    <motion.nav
      variants={menuVariants}
      initial="closed"
      animate={isOpen ? "open" : "closed"}
      className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg"
    >
      {menuItems.map((item, index) => (
        <motion.a
          key={index}
          variants={itemVariants}
          href={item.href}
          className="block px-4 py-2"
        >
          {item.label}
        </motion.a>
      ))}
    </motion.nav>
  );
}
```

### 3. Progress Animations

```typescript
// components/ProgressBar.tsx
import { motion, useScroll } from "framer-motion";

export function ProgressBar() {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-primary"
      style={{ scaleX: scrollYProgress }}
    />
  );
}
```
