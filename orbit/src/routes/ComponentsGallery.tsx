import { useState } from "react";
import { Bell, Download, Plus, Star, Trash2 } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  ProgressBar,
  SearchInput,
  Segmented,
  Select,
  Textarea,
} from "../components/ui";

export function ComponentsGallery() {
  const [segment, setSegment] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-6">
      <PageHeader
        title="Component Gallery"
        subtitle="The Orbit design system — one consistent set of Tailwind-based primitives."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Buttons"
            subtitle="variant × size, loading and icon props"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={Plus}>
              Primary
            </Button>
            <Button icon={Download}>Outline</Button>
            <Button variant="soft" icon={Star}>
              Soft
            </Button>
            <Button variant="ghost" icon={Bell}>
              Ghost
            </Button>
            <Button variant="danger" icon={Trash2}>
              Danger
            </Button>
            <Button variant="primary" size="sm" loading>
              Loading
            </Button>
            <Button size="xs">Extra small</Button>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell size={15} />
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Badges & avatars" subtitle="semantic tones" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge>default</Badge>
            <Badge tone="brand">brand</Badge>
            <Badge tone="info">info</Badge>
            <Badge tone="success">success</Badge>
            <Badge tone="warning">warning</Badge>
            <Badge tone="danger">danger</Badge>
            <span className="ml-2 flex items-center -space-x-1.5">
              <Avatar name="Abhishek Prajapati" />
              <Avatar name="Sarah Connor" />
              <Avatar name="Alex Rivera" />
            </span>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Forms"
            subtitle="Field wires label + hint + error"
          />
          <div className="space-y-4">
            <Field label="Input" hint="Helper text appears under the control.">
              <Input placeholder="Type here…" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Select">
                <Select defaultValue="a">
                  <option value="a">Option A</option>
                  <option value="b">Option B</option>
                </Select>
              </Field>
              <Field label="Search">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Filter…"
                />
              </Field>
            </div>
            <Field
              label="Textarea"
              error="Errors replace the hint and use the danger tone."
            >
              <Textarea placeholder="Longer content…" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Controls"
            subtitle="segmented groups and progress"
          />
          <div className="space-y-5">
            <Segmented
              value={segment}
              onChange={setSegment}
              options={[
                { value: "grid", label: "Grid" },
                { value: "list", label: "List" },
              ]}
            />
            <div className="space-y-3">
              <ProgressBar value={72} />
              <ProgressBar value={45} tone="info" />
              <ProgressBar value={88} tone="ok" />
              <ProgressBar value={24} tone="warn" />
              <ProgressBar value={12} tone="danger" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
