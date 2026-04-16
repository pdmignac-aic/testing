export type Company = {
  id: string;
  company_name: string | null;
  identifier: string | null;
  is_duplicate: string | null;
  status: string | null;
  owner: string | null;
  layer: string | null;
  dirty_grade: string | null;
  components: string | null;
  full_address: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  founding_year: number | null;
  territory: string | null;
  notes: string | null;
  contact_name: string | null;
  contact_title: string | null;
  email: string | null;
  other: string | null;
  warm_intro: string | null;
  phone_linkedin: string | null;
  notes2: string | null;
  touch_1_date: string | null;
  touch_1_channel: string | null;
  touch_2_date: string | null;
  touch_2_channel: string | null;
  touch_3_date: string | null;
  touch_3_channel: string | null;
  touch_4_date: string | null;
  touch_4_channel: string | null;
  touch_5_date: string | null;
  touch_5_channel: string | null;
  touch_6_date: string | null;
  touch_6_channel: string | null;
  linkedin_date: string | null;
  linkedin: string | null;
  response_date: string | null;
  engaged_date: string | null;
  email_count: number | null;
  tp1_sent: boolean | null;
  tp2_sent: boolean | null;
  tp3_sent: boolean | null;
  tp1_date: string | null;
  tp2_date: string | null;
  tp3_date: string | null;
  created_at: string;
  updated_at: string;
};

export type CsvColumn = {
  csvHeader: string;
  dbColumn: keyof Company | null;
  type: "text" | "int" | "numeric" | "boolean" | "date";
};

export const CSV_COLUMNS: CsvColumn[] = [
  { csvHeader: "Company Name", dbColumn: "company_name", type: "text" },
  { csvHeader: "Identifier", dbColumn: "identifier", type: "text" },
  { csvHeader: "Duplicate?", dbColumn: "is_duplicate", type: "text" },
  { csvHeader: "Status", dbColumn: "status", type: "text" },
  { csvHeader: "Owner", dbColumn: "owner", type: "text" },
  { csvHeader: "Layer", dbColumn: "layer", type: "text" },
  { csvHeader: "Dirty Grade", dbColumn: "dirty_grade", type: "text" },
  { csvHeader: "Components", dbColumn: "components", type: "text" },
  { csvHeader: "Full Address", dbColumn: "full_address", type: "text" },
  { csvHeader: "Street", dbColumn: "street", type: "text" },
  { csvHeader: "City", dbColumn: "city", type: "text" },
  { csvHeader: "State", dbColumn: "state", type: "text" },
  { csvHeader: "Zip", dbColumn: "zip", type: "text" },
  { csvHeader: "Country", dbColumn: "country", type: "text" },
  { csvHeader: "Founding Year", dbColumn: "founding_year", type: "int" },
  { csvHeader: "Territory", dbColumn: "territory", type: "text" },
  { csvHeader: "Notes", dbColumn: "notes", type: "text" },
  { csvHeader: "Contact Name", dbColumn: "contact_name", type: "text" },
  { csvHeader: "Contact Title", dbColumn: "contact_title", type: "text" },
  { csvHeader: "Email", dbColumn: "email", type: "text" },
  { csvHeader: "Other", dbColumn: "other", type: "text" },
  { csvHeader: "Warm Intro?", dbColumn: "warm_intro", type: "text" },
  { csvHeader: "Phone/LinkedIn", dbColumn: "phone_linkedin", type: "text" },
  { csvHeader: "Notes2", dbColumn: "notes2", type: "text" },
  { csvHeader: "Touch 1 Date", dbColumn: "touch_1_date", type: "date" },
  { csvHeader: "Touch 1 Channel", dbColumn: "touch_1_channel", type: "text" },
  { csvHeader: "Touch 2 Date", dbColumn: "touch_2_date", type: "date" },
  { csvHeader: "Touch 2 Channel", dbColumn: "touch_2_channel", type: "text" },
  { csvHeader: "Touch 3 Date", dbColumn: "touch_3_date", type: "date" },
  { csvHeader: "Touch 3 Channel", dbColumn: "touch_3_channel", type: "text" },
  { csvHeader: "Touch 4 Date", dbColumn: "touch_4_date", type: "date" },
  { csvHeader: "Touch 4 Channel", dbColumn: "touch_4_channel", type: "text" },
  { csvHeader: "Touch 5 Date", dbColumn: "touch_5_date", type: "date" },
  { csvHeader: "Touch 5 Channel", dbColumn: "touch_5_channel", type: "text" },
  { csvHeader: "Touch 6 Date", dbColumn: "touch_6_date", type: "date" },
  { csvHeader: "Touch 6 Channel", dbColumn: "touch_6_channel", type: "text" },
  { csvHeader: "LinkedIn Date", dbColumn: "linkedin_date", type: "date" },
  { csvHeader: "LinkedIn", dbColumn: "linkedin", type: "text" },
  { csvHeader: "Response Date", dbColumn: "response_date", type: "date" },
  { csvHeader: "Engaged Date", dbColumn: "engaged_date", type: "date" },
  { csvHeader: "Email Count", dbColumn: "email_count", type: "numeric" },
  { csvHeader: "TP1 Sent?", dbColumn: "tp1_sent", type: "boolean" },
  { csvHeader: "TP2 Sent?", dbColumn: "tp2_sent", type: "boolean" },
  { csvHeader: "TP3 Sent?", dbColumn: "tp3_sent", type: "boolean" },
  { csvHeader: "TP1 Date", dbColumn: "tp1_date", type: "date" },
  { csvHeader: "TP2 Date", dbColumn: "tp2_date", type: "date" },
  { csvHeader: "TP3 Date", dbColumn: "tp3_date", type: "date" },
  { csvHeader: "Column 48", dbColumn: null, type: "text" },
  { csvHeader: "Column 49", dbColumn: null, type: "text" },
  { csvHeader: "Column 50", dbColumn: null, type: "text" },
];

export const DISPLAY_COLUMNS: { key: keyof Company; label: string }[] = [
  { key: "company_name", label: "Company" },
  { key: "identifier", label: "Domain" },
  { key: "status", label: "Status" },
  { key: "owner", label: "Owner" },
  { key: "layer", label: "Layer" },
  { key: "dirty_grade", label: "Grade" },
  { key: "territory", label: "Territory" },
  { key: "contact_name", label: "Contact" },
  { key: "contact_title", label: "Title" },
  { key: "email", label: "Email" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "email_count", label: "# Emails" },
  { key: "tp1_sent", label: "TP1" },
  { key: "tp2_sent", label: "TP2" },
  { key: "tp3_sent", label: "TP3" },
  { key: "response_date", label: "Responded" },
  { key: "engaged_date", label: "Engaged" },
];
