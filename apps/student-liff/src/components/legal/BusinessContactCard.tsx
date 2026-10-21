import { Mail, MapPin, MessageCircle, Phone, UserRound } from "lucide-react";
import { Surface } from "@/components/mobile";
import { businessContact } from "@/lib/businessContact";

/** Public business contact details shown on the storefront and legal pages. */
export function BusinessContactCard() {
  return (
    <Surface as="section" padding="md" className="w-full" aria-label="ข้อมูลติดต่อผู้ให้บริการ">
      <h2 className="text-sm font-bold text-fg">ข้อมูลติดต่อผู้ให้บริการ</h2>
      <dl className="mt-3 flex flex-col gap-3 text-sm leading-[1.6]">
        <div className="flex items-start gap-2.5">
          <UserRound aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-icon-brand" />
          <div>
            <dt className="font-semibold text-fg">ผู้ติดต่อ</dt>
            <dd className="text-fg-muted">{businessContact.contactName}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-icon-brand" />
          <div>
            <dt className="font-semibold text-fg">อีเมล</dt>
            <dd>
              <a className="break-all font-semibold text-brand-700 underline underline-offset-2" href={businessContact.emailHref}>
                {businessContact.email}
              </a>
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-icon-brand" />
          <div>
            <dt className="font-semibold text-fg">ที่อยู่</dt>
            <dd className="text-fg-muted not-italic">{businessContact.address}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-icon-brand" />
          <div>
            <dt className="font-semibold text-fg">โทรศัพท์</dt>
            <dd>
              <a className="font-semibold text-brand-700 underline underline-offset-2" href={businessContact.phoneHref}>
                {businessContact.phone}
              </a>
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <MessageCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-icon-brand" />
          <div>
            <dt className="font-semibold text-fg">LINE Official</dt>
            <dd>
              <a
                className="font-semibold text-brand-700 underline underline-offset-2"
                href={businessContact.lineUrl}
                target="_blank"
                rel="noreferrer"
              >
                {businessContact.lineLabel}
              </a>
            </dd>
          </div>
        </div>
      </dl>
    </Surface>
  );
}
