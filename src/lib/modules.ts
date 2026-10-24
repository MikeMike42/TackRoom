/**
 * Module definitions. Each module maps 1:1 to a Supabase table; every field
 * key is a column name. The generic list/form UI is driven entirely from here,
 * so adding a column to a table and a line below is all it takes to extend
 * the app.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'select'
  | 'date'
  | 'number'
  | 'money'
  | 'boolean'
  | 'tags'
  | 'ref'
  | 'file'

export type Option = { value: string; label: string; tone?: Tone }
export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info'

export type Field = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: Option[]
  /** For type 'ref': which module the value points at. */
  ref?: ModuleKey
  /** Show only when another field has one of these values. */
  showWhen?: { field: string; in: string[] }
  /** Read-only in the form (filled by the system). */
  readOnly?: boolean
  placeholder?: string
  help?: string
  /** Column in the list table. */
  list?: boolean
  /** Span the full form width. */
  wide?: boolean
}

export type ModuleKey =
  | 'waiver_templates'
  | 'clients'
  | 'horses'
  | 'offerings'
  | 'waivers'
  | 'contracts'
  | 'scripts'
  | 'homework'

export type Module = {
  key: ModuleKey
  table: string
  label: string
  singular: string
  blurb: string
  icon: string
  /** Field used as the record's display name. */
  titleKey: string
  /** Field whose value is rendered as a status pill, if any. */
  statusKey?: string
  /** Field holding a date whose approach matters (dashboard "expiring soon"). */
  expiryKey?: string
  /** Fields used to filter the list. */
  filters?: string[]
  /** Default sort. */
  orderBy: { column: string; ascending: boolean }
  fields: Field[]
  /** Variant presentation of the list. */
  view: 'table' | 'cards'
  /** Hide from the main nav (reached from another module). */
  hidden?: boolean
}

const WAIVER_TYPES: Option[] = [
  { value: 'liability', label: 'Liability' },
  { value: 'photo_release', label: 'Photo release' },
  { value: 'medical', label: 'Medical' },
  { value: 'minor_consent', label: 'Minor consent' },
  { value: 'other', label: 'Other' },
]

const LEVELS: Option[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'advanced_beginner', label: 'Advanced beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]
const LEVELS_ALL: Option[] = [{ value: 'all', label: 'All levels' }, ...LEVELS]

const DOC_STATUS: Option[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'sent', label: 'Sent', tone: 'info' },
  { value: 'signed', label: 'Signed', tone: 'good' },
  { value: 'expired', label: 'Expired', tone: 'bad' },
]

export const MODULES: Module[] = [
  {
    key: 'waivers',
    table: 'waivers',
    label: 'Waivers',
    singular: 'Waiver',
    blurb: 'Liability, photo, medical and minor-consent waivers, filed per rider.',
    icon: 'shield',
    titleKey: 'title',
    statusKey: 'status',
    expiryKey: 'expires_on',
    filters: ['status', 'waiver_type'],
    orderBy: { column: 'updated_at', ascending: false },
    view: 'table',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, list: true, placeholder: 'e.g. Liability waiver — Avery Cole' },
      { key: 'client_id', label: 'Rider', type: 'ref', ref: 'clients', list: true },
      { key: 'template_id', label: 'Template', type: 'ref', ref: 'waiver_templates', help: 'The text the rider will sign. Manage templates from the Waivers page.' },
      { key: 'waiver_type', label: 'Type', type: 'select', required: true, list: true, options: WAIVER_TYPES },
      { key: 'status', label: 'Status', type: 'select', required: true, list: true, options: DOC_STATUS },
      { key: 'signer_email', label: 'Signer email', type: 'text', placeholder: 'Filled in when you send for signature' },
      { key: 'signed_on', label: 'Signed on', type: 'date', list: true },
      { key: 'expires_on', label: 'Expires on', type: 'date', list: true, help: 'Leave blank if it never expires.' },
      { key: 'file_path', label: 'Signed PDF (paper copy)', type: 'file', wide: true, help: 'For waivers signed on paper or elsewhere. E-signed waivers generate their own PDF.' },
      { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
    ],
  },
  {
    key: 'waiver_templates',
    table: 'waiver_templates',
    label: 'Waiver templates',
    singular: 'Template',
    blurb: 'The text riders agree to. Write it once per waiver type; every waiver sent for signature uses a snapshot of the template at that moment.',
    icon: 'shield',
    titleKey: 'name',
    statusKey: 'waiver_type',
    filters: ['waiver_type'],
    orderBy: { column: 'name', ascending: true },
    view: 'cards',
    hidden: true,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, list: true, placeholder: 'e.g. Standard liability release 2026' },
      { key: 'waiver_type', label: 'Type', type: 'select', required: true, list: true, options: WAIVER_TYPES.map((o, i) => ({ ...o, tone: (['good', 'info', 'warn', 'bad', 'neutral'] as Tone[])[i] })) },
      { key: 'valid_days', label: 'Valid for (days)', type: 'number', help: 'Sets the expiry date automatically when signed. Blank = never expires.' },
      { key: 'requires_guardian_for_minors', label: 'Guardian must sign for riders under 18', type: 'boolean' },
      { key: 'active', label: 'In use', type: 'boolean' },
      { key: 'body', label: 'Waiver text', type: 'markdown', required: true, wide: true, help: 'Markdown. Headings, bold and numbered lists all render on the signing page and in the PDF.' },
    ],
  },
  {
    key: 'contracts',
    table: 'contracts',
    label: 'Contracts',
    singular: 'Contract',
    blurb: 'Lesson package agreements and horse leases, with the signed copy attached.',
    icon: 'file-signature',
    titleKey: 'title',
    statusKey: 'status',
    expiryKey: 'end_date',
    filters: ['status', 'contract_type'],
    orderBy: { column: 'updated_at', ascending: false },
    view: 'table',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, list: true, placeholder: 'e.g. 10-lesson package — Avery Cole' },
      {
        key: 'contract_type', label: 'Type', type: 'select', required: true, list: true,
        options: [
          { value: 'lesson_package', label: 'Lesson package' },
          { value: 'horse_lease', label: 'Horse lease' },
        ],
      },
      { key: 'client_id', label: 'Client', type: 'ref', ref: 'clients', list: true },
      { key: 'offering_id', label: 'Package', type: 'ref', ref: 'offerings', showWhen: { field: 'contract_type', in: ['lesson_package'] } },
      { key: 'horse_id', label: 'Horse', type: 'ref', ref: 'horses', list: true, showWhen: { field: 'contract_type', in: ['horse_lease'] } },
      {
        key: 'status', label: 'Status', type: 'select', required: true, list: true,
        options: [
          { value: 'draft', label: 'Draft', tone: 'neutral' },
          { value: 'sent', label: 'Sent', tone: 'info' },
          { value: 'signed', label: 'Signed', tone: 'good' },
          { value: 'active', label: 'Active', tone: 'good' },
          { value: 'expired', label: 'Expired', tone: 'bad' },
          { value: 'cancelled', label: 'Cancelled', tone: 'warn' },
        ],
      },
      { key: 'start_date', label: 'Starts', type: 'date', list: true },
      { key: 'end_date', label: 'Ends', type: 'date', list: true },
      { key: 'amount', label: 'Amount', type: 'money' },
      {
        key: 'billing', label: 'Billing', type: 'select',
        options: [
          { value: 'one_time', label: 'One time' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'per_lesson', label: 'Per lesson' },
        ],
      },
      { key: 'file_path', label: 'Signed PDF', type: 'file', wide: true },
      { key: 'terms', label: 'Key terms', type: 'textarea', wide: true, help: 'Anything staff should know without opening the PDF: cancellation window, included tack, vet responsibilities.' },
    ],
  },
  {
    key: 'offerings',
    table: 'offerings',
    label: 'Offerings',
    singular: 'Offering',
    blurb: 'What you sell: lesson package levels, workshops, clinics and camps.',
    icon: 'layers',
    titleKey: 'name',
    statusKey: 'category',
    filters: ['category', 'level'],
    orderBy: { column: 'name', ascending: true },
    view: 'cards',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, list: true, placeholder: 'e.g. Foundations — 8 lessons' },
      {
        key: 'category', label: 'Category', type: 'select', required: true, list: true,
        options: [
          { value: 'lesson_package', label: 'Lesson package', tone: 'good' },
          { value: 'private_lesson', label: 'Private lesson', tone: 'info' },
          { value: 'group_lesson', label: 'Group lesson', tone: 'info' },
          { value: 'workshop', label: 'Workshop', tone: 'warn' },
          { value: 'clinic', label: 'Clinic', tone: 'warn' },
          { value: 'camp', label: 'Camp', tone: 'warn' },
          { value: 'other', label: 'Other', tone: 'neutral' },
        ],
      },
      { key: 'level', label: 'Level', type: 'select', options: LEVELS_ALL, list: true },
      { key: 'lessons_included', label: 'Lessons included', type: 'number' },
      { key: 'duration_minutes', label: 'Lesson length (min)', type: 'number' },
      { key: 'price', label: 'Price', type: 'money', list: true },
      { key: 'validity_days', label: 'Valid for (days)', type: 'number', help: 'How long a buyer has to use the package.' },
      { key: 'active', label: 'Currently offered', type: 'boolean' },
      { key: 'description', label: 'Description', type: 'markdown', wide: true, help: 'What riders learn, what is included, prerequisites.' },
    ],
  },
  {
    key: 'scripts',
    table: 'scripts',
    label: 'Scripts',
    singular: 'Script',
    blurb: 'Email and text automation copy, plus YouTube video plans. Use {{placeholders}} for anything that changes per rider.',
    icon: 'message',
    titleKey: 'title',
    statusKey: 'channel',
    filters: ['channel'],
    orderBy: { column: 'updated_at', ascending: false },
    view: 'cards',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, list: true, placeholder: 'e.g. Welcome — new rider, day 1' },
      {
        key: 'channel', label: 'Channel', type: 'select', required: true, list: true,
        options: [
          { value: 'email', label: 'Email', tone: 'info' },
          { value: 'text', label: 'Text', tone: 'good' },
          { value: 'youtube', label: 'YouTube', tone: 'warn' },
        ],
      },
      { key: 'purpose', label: 'When it goes out', type: 'text', placeholder: 'e.g. 24h before first lesson', list: true },
      { key: 'subject', label: 'Subject line', type: 'text', showWhen: { field: 'channel', in: ['email'] }, wide: true },
      { key: 'body', label: 'Script', type: 'textarea', required: true, wide: true, placeholder: 'Hi {{first_name}}, …' },
      { key: 'tags', label: 'Tags', type: 'tags', wide: true, placeholder: 'onboarding, reminder, promo' },
    ],
  },
  {
    key: 'homework',
    table: 'homework',
    label: 'Homework',
    singular: 'Assignment',
    blurb: 'Homework, worksheets and reading for every course, written here or attached as a PDF.',
    icon: 'book',
    titleKey: 'title',
    statusKey: 'kind',
    filters: ['kind', 'offering_id', 'level'],
    orderBy: { column: 'updated_at', ascending: false },
    view: 'cards',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, list: true, placeholder: 'e.g. Parts of the saddle — label the diagram' },
      {
        key: 'kind', label: 'Kind', type: 'select', required: true, list: true,
        options: [
          { value: 'homework', label: 'Homework', tone: 'good' },
          { value: 'worksheet', label: 'Worksheet', tone: 'info' },
          { value: 'reading', label: 'Reading', tone: 'neutral' },
          { value: 'quiz', label: 'Quiz', tone: 'warn' },
        ],
      },
      { key: 'offering_id', label: 'Course', type: 'ref', ref: 'offerings', list: true },
      { key: 'level', label: 'Level', type: 'select', options: LEVELS_ALL },
      { key: 'estimated_minutes', label: 'Estimated time (min)', type: 'number' },
      { key: 'body', label: 'Content', type: 'markdown', wide: true, help: 'Markdown. Use "- [ ]" for checkboxes, "1." for numbered steps, and "---" for a page break when printing.' },
      { key: 'file_path', label: 'Attached PDF', type: 'file', wide: true },
    ],
  },
  {
    key: 'clients',
    table: 'clients',
    label: 'Riders',
    singular: 'Rider',
    blurb: 'Students and their contacts. Waivers and contracts link here.',
    icon: 'user',
    titleKey: 'full_name',
    statusKey: 'rider_level',
    filters: ['rider_level'],
    orderBy: { column: 'full_name', ascending: true },
    view: 'table',
    fields: [
      { key: 'full_name', label: 'Name', type: 'text', required: true, list: true },
      { key: 'email', label: 'Email', type: 'text', list: true },
      { key: 'phone', label: 'Phone', type: 'text', list: true },
      { key: 'rider_level', label: 'Level', type: 'select', options: LEVELS, list: true },
      { key: 'guardian_name', label: 'Parent / guardian', type: 'text', help: 'For minors.' },
      { key: 'emergency_contact', label: 'Emergency contact', type: 'text', placeholder: 'Name — phone' },
      { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
    ],
  },
  {
    key: 'horses',
    table: 'horses',
    label: 'Horses',
    singular: 'Horse',
    blurb: 'Lesson and lease horses. Lease contracts link here.',
    icon: 'horse',
    titleKey: 'name',
    statusKey: 'lease_status',
    filters: ['lease_status'],
    orderBy: { column: 'name', ascending: true },
    view: 'table',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, list: true },
      { key: 'breed', label: 'Breed', type: 'text', list: true },
      { key: 'age', label: 'Age', type: 'number', list: true },
      { key: 'height_hands', label: 'Height (hh)', type: 'number', list: true },
      {
        key: 'lease_status', label: 'Status', type: 'select', required: true, list: true,
        options: [
          { value: 'available', label: 'Available', tone: 'good' },
          { value: 'leased', label: 'Leased', tone: 'info' },
          { value: 'lesson_only', label: 'Lesson only', tone: 'neutral' },
          { value: 'retired', label: 'Retired', tone: 'warn' },
        ],
      },
      { key: 'temperament', label: 'Temperament', type: 'text', placeholder: 'e.g. steady, good for nervous beginners' },
      { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
    ],
  },
]

export const moduleByKey = (key: string) => MODULES.find((m) => m.key === key)

export type Row = Record<string, unknown> & {
  id: string
  created_at?: string
  updated_at?: string
  created_by?: string | null
  updated_by?: string | null
}
