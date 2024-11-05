# shadcn/ui Documentation

## Overview

shadcn/ui is our primary UI component library, providing a collection of reusable, accessible components built on top of Radix UI and styled with Tailwind CSS.

## Installation and Setup

The library is already configured in our project with the following setup:

```bash
# Installation was done using
npx shadcn-ui@latest init
```

Configuration files:

- `components.json` - Component configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `app/globals.css` - Global styles

## Component Usage Guidelines

### 1. Button Component

```typescript
import { Button } from "@/components/ui/button";

// Primary button
<Button>Click me</Button>

// Secondary variant
<Button variant="secondary">Secondary</Button>

// Disabled state
<Button disabled>Disabled</Button>

// With icon
<Button>
  <PlusIcon className="mr-2 h-4 w-4" />
  Add Item
</Button>
```

### 2. Form Components

```typescript
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Basic form setup
const form = useForm({
  defaultValues: {
    username: "",
  },
});

return (
  <Form {...form}>
    <FormField
      control={form.control}
      name="username"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Username</FormLabel>
          <FormControl>
            <Input placeholder="Enter username" {...field} />
          </FormControl>
          <FormDescription>This is your public display name.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </Form>
);
```

### 3. Dialog Component

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger>Open Dialog</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Are you sure?</DialogTitle>
      <DialogDescription>This action cannot be undone.</DialogDescription>
    </DialogHeader>
    <div className="flex justify-end gap-3">
      <Button variant="outline">Cancel</Button>
      <Button>Continue</Button>
    </div>
  </DialogContent>
</Dialog>;
```

## Customization Guidelines

### 1. Theme Customization

```typescript
// tailwind.config.ts
import { type Config } from "tailwindcss";

const config = {
  theme: {
    extend: {
      colors: {
        // Custom brand colors
        primary: {
          DEFAULT: "#007AFF",
          dark: "#0056B3",
        },
        // Custom semantic colors
        success: "#28A745",
        warning: "#FFC107",
        error: "#DC3545",
      },
    },
  },
} satisfies Config;

export default config;
```

### 2. Component Variants

```typescript
// components/ui/button.tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // Custom variant
        success: "bg-success text-white hover:bg-success/90",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

## Best Practices

### 1. Component Composition

```typescript
// Good: Composable component
const Card = ({ title, children, footer }) => {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      {title && (
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
      {footer && <div className="p-6 border-t bg-muted/50">{footer}</div>}
    </div>
  );
};
```

### 2. Form Validation

```typescript
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const SignInForm = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
};
```

## Accessibility Considerations

### 1. Keyboard Navigation

- All interactive components are keyboard accessible
- Focus states are clearly visible
- Tab order follows logical flow

### 2. ARIA Attributes

```typescript
// Dialog with proper ARIA attributes
<Dialog>
  <DialogTrigger asChild>
    <Button aria-label="Open settings">Settings</Button>
  </DialogTrigger>
  <DialogContent aria-describedby="dialog-description">
    <DialogHeader>
      <DialogTitle>Settings</DialogTitle>
      <DialogDescription id="dialog-description">
        Adjust your application settings here.
      </DialogDescription>
    </DialogHeader>
  </DialogContent>
</Dialog>
```

## Performance Optimization

### 1. Component Loading

```typescript
// Lazy load heavy components
const HeavyDialog = dynamic(() => import("@/components/HeavyDialog"), {
  loading: () => <div>Loading...</div>,
  ssr: false,
});
```

### 2. State Management

```typescript
// Use local state for UI components
const [isOpen, setIsOpen] = useState(false);

// Memoize callbacks
const handleOpen = useCallback(() => {
  setIsOpen(true);
}, []);
```

## Common Patterns

### 1. Data Display

```typescript
// Data table with sorting and pagination
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DataTable = ({ data, columns }) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key}>{column.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.id}>
            {columns.map((column) => (
              <TableCell key={`${row.id}-${column.key}`}>
                {row[column.key]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
```

### 2. Form Patterns

```typescript
// Form with multiple steps
const MultiStepForm = () => {
  const [step, setStep] = useState(1);

  return (
    <div>
      <div className="mb-8">
        <Progress value={(step / 3) * 100} />
      </div>

      {step === 1 && <PersonalDetails />}
      {step === 2 && <ContactDetails />}
      {step === 3 && <Confirmation />}

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          Previous
        </Button>
        <Button onClick={() => setStep(step + 1)} disabled={step === 3}>
          Next
        </Button>
      </div>
    </div>
  );
};
```

## Troubleshooting

### Common Issues

1. **Styling Conflicts**

   - Use proper CSS specificity
   - Check Tailwind class order
   - Verify theme configuration

2. **Form Validation**

   - Ensure proper Zod schema
   - Check form field names
   - Verify error handling

3. **Component State**
   - Check controlled vs uncontrolled components
   - Verify state updates
   - Debug re-render issues

## Component Tracking

| Component  | Status      | Notes                               |
| ---------- | ----------- | ----------------------------------- |
| Button     | ✅ Complete | All variants implemented            |
| Input      | ✅ Complete | Including number and password types |
| Form       | ✅ Complete | With Zod integration                |
| Dialog     | ✅ Complete | With animations                     |
| Table      | ✅ Complete | With sorting capabilities           |
| Tabs       | ✅ Complete | With keyboard navigation            |
| Card       | ✅ Complete | All variants implemented            |
| Toast      | ✅ Complete | With auto-dismiss                   |
| Progress   | ✅ Complete | With animations                     |
| Switch     | ✅ Complete | With label support                  |
| RadioGroup | ✅ Complete | With form integration               |
| Select     | ✅ Complete | With search functionality           |
| Textarea   | ✅ Complete | With auto-resize                    |
| Accordion  | ✅ Complete | With animations                     |
| Carousel   | ✅ Complete | With touch support                  |
