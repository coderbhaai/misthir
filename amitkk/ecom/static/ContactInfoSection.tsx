import React from "react";
import { TextField } from "@amitkk/components/basic/TextField";
import { Checkbox } from "@amitkk/components/basic/checkbox";
import { Label } from "@amitkk/components/basic/label";

interface ContactInfoSectionProps {
  email?: string;
  setEmail?: (val: string) => void;
  phone?: string;
  setPhone?: (val: string) => void;
  emailConsent?: boolean;
  setEmailConsent?: (val: boolean) => void;
  phoneConsent?: boolean;
  setPhoneConsent?: (val: boolean) => void;
  editable?: boolean;
  maskContact?: boolean;
  onBlur?: () => void;
}

function maskEmail(value: string): string {
  if (!value) return "";
  const visiblePrefix = value.slice(0, 5);
  const remainingCount = Math.max(value.length - 5, 3);
  return `${visiblePrefix}${"*".repeat(remainingCount)}`;
}

function maskPhone(value: string): string {
  if (!value) return "";
  const lastFour = value.slice(-4);
  const maskedCount = Math.max(value.length - 4, 3);
  return `${"*".repeat(maskedCount)}${lastFour}`;
}

export default function ContactInfoSection({
  email = "",
  setEmail,
  phone = "",
  setPhone,
  emailConsent = false,
  setEmailConsent,
  phoneConsent = false,
  setPhoneConsent,
  editable = true,
  maskContact = false,
  onBlur,
}: ContactInfoSectionProps) {
  const isMasked = Boolean(maskContact);
  const displayEmail = isMasked ? maskEmail(email) : email;
  const displayPhone = isMasked ? maskPhone(phone) : phone;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <TextField type={isMasked ? "text" : "email"} label="Email" value={displayEmail} name="email" onChange={(e) => setEmail?.(e.target.value)} required={editable && !isMasked} disabled={!editable || isMasked} onBlur={onBlur}/>
        <div className="flex items-center space-x-2 cursor-pointer">
          <Checkbox id="email-news" checked={Boolean(emailConsent)} disabled={!editable} onCheckedChange={(checked) => setEmailConsent?.(Boolean(checked))}/>
          <Label htmlFor="email-news" className="text-sm font-normal">Email me with news and offers</Label>
        </div>
      </div>

      <div className="space-y-1.5">
        <TextField type={isMasked ? "text" : "tel"} label="Phone" value={displayPhone} name="phone" onChange={(e) => setPhone?.(e.target.value)} required={editable && !isMasked} disabled={!editable || isMasked} onBlur={onBlur} />
        <div className="flex items-center space-x-2 cursor-pointer">
          <Checkbox id="whatsapp-news" checked={Boolean(phoneConsent)} disabled={!editable} onCheckedChange={(checked) => setPhoneConsent?.(Boolean(checked))}/>
          <Label htmlFor="whatsapp-news" className="text-sm font-normal">Whatsapp me with news and offers</Label>
        </div>
      </div>
    </div>
  );
}