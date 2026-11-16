import { Mail, MapPin, MessageCircle, Phone, UserRound } from "lucide-react";
import { Surface } from "@/components/mobile";
import { businessContact } from "@/lib/businessContact";
import { keepThaiWords } from "@/lib/thaiText";

// Each row keeps <dt>/<dd> as direct children of the row <div> (valid <dl>
// grouping, so screen readers pair term and value). The icon sits in the <dt>
// gutter; links get a 44px tap height.
const termClass = "relative pl-[26px] font-semibold text-fg";
const iconClass = "absolute top-[3px] left-0 size-4 text-icon-brand";
const valueClass = "pl-[26px]";
const linkClass = "inline-flex min-h-11 items-center font-semibold text-brand-fg underline underline-offset-2";

// On a narrow phone the address wraps after "@" ("support@" / "reading-advantage.com")
// instead of splitting a word mid-letter; the domain itself never breaks.
const emailAt = businessContact.email.indexOf("@") + 1;
const emailLocal = businessContact.email.slice(0, emailAt);
const emailDomain = businessContact.email.slice(emailAt);

/** Public business contact details shown on the storefront and legal pages. */
export function BusinessContactCard() {
  return (
    <Surface as="section" padding="md" className="w-full text-left" aria-label="ข้อมูลติดต่อผู้ให้บริการ">
      <h2 className="t-title-s text-fg">ข้อมูลติดต่อผู้ให้บริการ</h2>
      <dl className="mt-3 flex flex-col gap-3 text-sm leading-[1.6]">
        <div>
          <dt className={termClass}>
            <UserRound aria-hidden="true" className={iconClass} />
            ผู้ติดต่อ
          </dt>
          <dd className={`${valueClass} text-fg-muted`}>{businessContact.contactName}</dd>
        </div>
        <div>
          <dt className={termClass}>
            <Mail aria-hidden="true" className={iconClass} />
            อีเมล
          </dt>
          <dd className={valueClass}>
            <a className={linkClass} href={businessContact.emailHref}>
              <span>
                {emailLocal}
                <wbr />
                <span className="whitespace-nowrap">{emailDomain}</span>
              </span>
            </a>
          </dd>
        </div>
        <div>
          <dt className={termClass}>
            <MapPin aria-hidden="true" className={iconClass} />
            ที่อยู่
          </dt>
          <dd className={`${valueClass} text-fg-muted not-italic`}>{keepThaiWords(businessContact.address)}</dd>
        </div>
        <div>
          <dt className={termClass}>
            <Phone aria-hidden="true" className={iconClass} />
            โทรศัพท์
          </dt>
          <dd className={valueClass}>
            <a className={linkClass} href={businessContact.phoneHref}>
              {businessContact.phone}
            </a>
          </dd>
        </div>
        <div>
          <dt className={termClass}>
            <MessageCircle aria-hidden="true" className={iconClass} />
            LINE Official
          </dt>
          <dd className={valueClass}>
            <a className={linkClass} href={businessContact.lineUrl} target="_blank" rel="noreferrer">
              {businessContact.lineLabel}
            </a>
          </dd>
        </div>
      </dl>
    </Surface>
  );
}
