import { useState } from 'react'
import { downloadAccountBulkTemplate } from '../api/accounts'
import BulkUploadDialog from '../components/BulkUploadDialog'
import CreateAccountDialog from '../components/CreateAccountDialog'
import { canCreateAccounts, canEditPrivilegedAccountFields, canUpdateTeams } from '../lib/roles'
import { getAccount, getToken } from '../lib/session'

type CreationTab = 'create' | 'bulk' | 'teams'

const OPTIONAL_COLUMNS = [
  { column: 'role', allowed: 'User, Admin, SuperAdmin, Developer (any case)', blank: 'User' },
  { column: 'No. of Reboot', allowed: 'Whole number 0 or higher', blank: '0' },
  { column: 'App Configuration', allowed: 'Whole number 1 or higher', blank: '1' },
  { column: 'Logout Button', allowed: 'true / false (also yes/no, 1/0)', blank: 'false' },
  { column: 'Is Offline', allowed: 'Same as Logout Button', blank: 'true' },
  { column: 'Source', allowed: 'Any text', blank: 'curl' },
] as const

const BULK_UPLOAD_FAQ = [
  {
    question: 'Who can bulk upload accounts?',
    answer:
      'Only SuperAdmin and Developer. From the sheet they can create accounts in any sanghat and set any role.',
  },
  {
    question: 'Do I have to use the official template?',
    answer:
      'No. Use Download template on this page, or a Nivedan sheet that already has a Mobile Number column. The Kendra sheet is preferred. Title rows above the header are ignored.',
  },
  {
    question: 'Can I upload a CSV or an older .xls file?',
    answer: 'No. The file must be .xlsx, 20 MB or smaller, and you can upload one file at a time.',
  },
  {
    question: 'What is the only required column?',
    answer:
      'Mobile Number. Use 10 digits only for US, UK, or India — no country code, spaces, or extension. Example: 9876543210. It must be unique and cannot be changed later.',
  },
  {
    question: 'What happens if I leave optional columns blank?',
    answer:
      'Role becomes User, No. of Reboot becomes 0, App Configuration becomes 1, Logout Button becomes false, Is Offline becomes true, and Source becomes curl. Unknown roles also become User.',
  },
  {
    question: 'Can I set the role to Sanchalak / Avekshak?',
    answer:
      'No. Do not use “Sanchalak/Avekshak S/A” as the account role. Allowed roles are User, Admin, SuperAdmin, and Developer.',
  },
  {
    question: 'If some rows fail, does the whole upload stop?',
    answer:
      'No. Failed rows are skipped and the rest still import. Created rows become accounts immediately. Open errors for the job to see the row, SN, phone, and reason.',
  },
  {
    question: 'Will this overwrite an account that already exists?',
    answer:
      'No. Duplicate phones in the file, or phones already in the system, are skipped. They are never overwritten.',
  },
  {
    question: 'Are teams created when I upload?',
    answer:
      'No. Teams are created later, when a device logs in, up to the No. of Teams Expected for that account. If that column is blank, it is treated as 1.',
  },
  {
    question: 'Can I create accounts in a different sanghat than mine?',
    answer:
      'Yes. Role and sanghat are stored as written in the file. There is no sanghat lock on bulk upload.',
  },
  {
    question: 'How long are import jobs kept?',
    answer: 'Jobs are kept for 7 days, then removed. Status goes queued → processing → completed or failed.',
  },
] as const

const CREATE_FAQ = [
  {
    question: 'Who can create an account from this page?',
    answer:
      'Only SuperAdmin and Admin. SuperAdmin can set any role and any sanghat. Admins can only create User accounts in their own sanghat.',
  },
  {
    question: 'What is required?',
    answer:
      'Only the mobile number. Use 10 digits for US, UK, or India — no country code, spaces, or extension. Example: 9876543210. It must be unique and cannot be changed later.',
  },
  {
    question: 'What if I leave the other fields as they are?',
    answer:
      'The form starts with the usual defaults: role User, number of teams 1, no. of reboot 0, app configuration 1, logout button off, offline on, and source curl. Change any of them before saving if you need to.',
  },
  {
    question: 'Can an Admin create an Admin or SuperAdmin?',
    answer: 'No. Admins can only create User accounts, and only in their own sanghat.',
  },
  {
    question: 'What if the phone number already exists?',
    answer: 'Create is rejected. Existing accounts are not overwritten.',
  },
  {
    question: 'Are teams created right away?',
    answer:
      'No. Teams are created later when a device logs in, up to the number of teams you set.',
  },
] as const

const UPDATE_TEAMS_ROW_ERRORS = [
  { error: 'Mobile Number is missing', cause: 'Phone cell empty' },
  { error: 'phone number is not 10 digits', cause: 'Not a supported 10-digit number' },
  { error: 'number does not exist', cause: 'Phone is not already in the database' },
  {
    error: 'team number is not a valid number',
    cause: 'Missing, 0, negative, decimal, or not an integer',
  },
  { error: 'duplicate mobile number in file', cause: 'Same phone appears twice in the sheet' },
  {
    error: 'numberOfTeams cannot be less than the N registered team(s)',
    cause: 'New count is below teams that already have a password or device',
  },
] as const

const UPDATE_TEAMS_JOB_FAILURES = [
  { message: 'Could not read the uploaded Excel file', meaning: 'Corrupt / not a readable xlsx' },
  { message: 'The uploaded Excel file has no sheets', meaning: 'Empty workbook' },
  {
    message: 'Could not find a sheet with a Mobile Number column',
    meaning: 'Header row not found',
  },
  { message: 'Uploaded Excel file is no longer available', meaning: 'File bytes were already cleared' },
  { message: 'Import failed', meaning: 'Unexpected processing error' },
] as const

const UPDATE_TEAMS_FAQ = [
  {
    question: 'Who can update teams?',
    answer: 'Only SuperAdmin and Developer.',
  },
  {
    question: 'Which column should I fill?',
    answer:
      'Fill Updated No. of Teams Expected in the nivedan sheet. If that updated column is not in the file, fill No. of Teams Expected instead.',
  },
  {
    question: 'What if the sheet has Updated No. of Teams Expected but a cell is empty?',
    answer:
      'That row fails with “team number is not a valid number”, even if No. of Teams Expected has a value. The updated column is required when it is present.',
  },
  {
    question: 'Do the phone numbers need to exist already?',
    answer:
      'Yes. This updates existing accounts. A phone that is not in the database fails with “number does not exist”.',
  },
  {
    question: 'Can I lower the team count?',
    answer:
      'Not below teams that already have a password or a device. That row fails with “numberOfTeams cannot be less than the N registered team(s)”.',
  },
  {
    question: 'If some rows fail, does the whole job fail?',
    answer:
      'No. Row errors do not fail the job. Status still becomes completed. Open errors when failedCount is greater than 0. Empty errors and total 0 means every row updated.',
  },
  {
    question: 'What does the Updated count mean?',
    answer: 'It is accounts updated, not accounts created.',
  },
] as const

function defaultTab(canCreate: boolean, canBulk: boolean): CreationTab {
  if (canCreate) {
    return 'create'
  }
  if (canBulk) {
    return 'bulk'
  }
  return 'teams'
}

export default function CreationPage() {
  const account = getAccount()
  const canBulkUpload = canEditPrivilegedAccountFields(account?.role)
  const canCreate = canCreateAccounts(account?.role)
  const canUpdateTeamCounts = canUpdateTeams(account?.role)
  const [tab, setTab] = useState<CreationTab>(() => defaultTab(canCreate, canBulkUpload))
  const [showCreate, setShowCreate] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showUpdateTeams, setShowUpdateTeams] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState('')
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  )

  const tabs = [
    { id: 'create' as const, label: 'Create', visible: canCreate },
    { id: 'bulk' as const, label: 'Bulk upload', visible: canBulkUpload },
    { id: 'teams' as const, label: 'Update Teams', visible: canUpdateTeamCounts },
  ].filter((item) => item.visible)

  const subtitle =
    tab === 'create'
      ? 'Create one account at a time.'
      : tab === 'bulk'
        ? 'Upload many accounts from an Excel sheet.'
        : 'Update No. of Teams Expected from a nivedan sheet.'

  function selectTab(next: CreationTab) {
    setTab(next)
    setStatus(null)
    setTemplateError('')
  }

  async function downloadTemplate() {
    setTemplateError('')
    const token = getToken()
    if (!token) {
      setTemplateError('Your session expired. Please log in again.')
      return
    }

    setDownloadingTemplate(true)
    try {
      await downloadAccountBulkTemplate(token)
    } catch (error) {
      setTemplateError(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Unable to download the template.',
      )
    } finally {
      setDownloadingTemplate(false)
    }
  }

  return (
    <div className="page-panel creation-page">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Creation</p>
          <h1>Creation</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="creation-toolbar">
        {tabs.length > 1 && (
          <div className="creation-tabs" role="tablist" aria-label="Creation pages">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`creation-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`creation-panel-${item.id}`}
                className={`creation-tab${tab === item.id ? ' is-active' : ''}`}
                onClick={() => selectTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'create' && canCreate && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setStatus(null)
                setShowCreate(true)
              }}
            >
              + Create
            </button>
          </div>
        )}
        {tab === 'bulk' && canBulkUpload && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setStatus(null)
                setShowUpload(true)
              }}
            >
              + Bulk upload
            </button>
          </div>
        )}
        {tab === 'teams' && canUpdateTeamCounts && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setStatus(null)
                setShowUpdateTeams(true)
              }}
            >
              + Update Teams
            </button>
          </div>
        )}
      </div>

      {status && (
        <p className={status.kind === 'error' ? 'form-error' : 'form-success'}>{status.text}</p>
      )}

      {tab === 'bulk' && canBulkUpload && (
        <section
          className="creation-guide"
          role="tabpanel"
          id="creation-panel-bulk"
          aria-labelledby="creation-tab-bulk"
        >
          <div className="creation-guide-intro">
            <h2 id="bulk-upload-guide-title">Bulk upload accounts</h2>
            <p>
              SuperAdmin and Developer only. From the sheet you can create accounts in any sanghat
              and assign any role.
            </p>
          </div>

          <ol className="creation-guide-steps">
            <li>
              <h3>Download the template</h3>
              <p>
                Use the Excel template, or a Nivedan sheet that already has a <strong>Mobile Number</strong>{' '}
                column. The <strong>Kendra</strong> sheet is preferred.
              </p>
              <div className="creation-guide-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void downloadTemplate()}
                  disabled={downloadingTemplate}
                >
                  {downloadingTemplate ? 'Downloading…' : 'Download template'}
                </button>
              </div>
              <p className="creation-guide-note">
                You can use the standard template you already have. This download is just an example.
              </p>
              {templateError && <p className="form-error">{templateError}</p>}
            </li>

            <li>
              <h3>Fill the sheet</h3>
              <p>
                <strong>Required — Mobile Number.</strong> Enter 10 digits only for US, UK, or India.
                Do not add a country code, spaces, or an extension. Example: <code>9876543210</code>.
                Each number must be unique, and it cannot be changed later.
              </p>
              <p>
                <strong>Recommended.</strong> Country Name or Country Code (<code>91</code> India,{' '}
                <code>44</code> UK, <code>1</code> US), Sanghat, Jilla, Taluka, Group, Yuva Kendra or
                DPC and its name, Sanchalak / Avekshak Name, and No. of Teams Expected (a whole number
                of 1 or more; blank is treated as 1).
              </p>
              <p>
                <strong>Optional — SuperAdmin can set these.</strong> Unknown roles become{' '}
                <strong>User</strong>. Do not use <code>Sanchalak/Avekshak S/A</code> as the account role.
              </p>
              <div className="creation-guide-table-wrap">
                <table className="creation-guide-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Allowed values</th>
                      <th>If blank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {OPTIONAL_COLUMNS.map((row) => (
                      <tr key={row.column}>
                        <td>
                          <code>{row.column}</code>
                        </td>
                        <td>{row.allowed}</td>
                        <td>
                          <code>{row.blank}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="creation-guide-note">
                Leave unused rows empty. Title rows above the header are ignored.
              </p>
            </li>

            <li>
              <h3>Upload the file</h3>
              <ul>
                <li>Use a <strong>.xlsx</strong> file — not .xls or CSV</li>
                <li>Maximum size is <strong>20 MB</strong></li>
                <li>Upload one file at a time</li>
              </ul>
              <p>
                The job is queued, then processed. Status moves from <code>queued</code> to{' '}
                <code>processing</code>, then <code>completed</code> or <code>failed</code>.
              </p>
            </li>

            <li>
              <h3>After upload</h3>
              <ul>
                <li>
                  <strong>Created</strong> rows become accounts immediately.
                </li>
                <li>
                  <strong>Failed</strong> rows are skipped. The rest of the file still imports.
                </li>
                <li>
                  Open <strong>errors</strong> for the job to see the row, SN, phone, and reason.
                </li>
              </ul>
              <p>Typical error reasons:</p>
              <ul>
                <li>Mobile Number is missing</li>
                <li>Phone number is not 10 digits</li>
                <li>Number already exists</li>
                <li>Country Code must be 91, 44, or 1</li>
                <li>Invalid number or true/false value in an optional column</li>
              </ul>
            </li>

            <li>
              <h3>What SuperAdmin should know</h3>
              <ul>
                <li>Role and sanghat in the file are stored as written. There is no sanghat lock.</li>
                <li>
                  Duplicate phones in the file, or phones that already exist, are skipped — they are
                  not overwritten.
                </li>
                <li>
                  Teams are <strong>not</strong> created by this upload. They are created later when a
                  device logs in, up to <strong>No. of Teams Expected</strong>.
                </li>
                <li>
                  Import jobs are kept for <strong>7 days</strong>, then removed.
                </li>
              </ul>
            </li>
          </ol>

          <section className="creation-faq" aria-labelledby="bulk-upload-faq-title">
            <h2 id="bulk-upload-faq-title">FAQ</h2>
            <p className="creation-faq-intro">Common questions about bulk upload.</p>
            <div className="creation-faq-list">
              {BULK_UPLOAD_FAQ.map((item) => (
                <details key={item.question} className="solution-card">
                  <summary>{item.question}</summary>
                  <p className="creation-faq-answer">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </section>
      )}

      {tab === 'create' && canCreate && (
        <section
          className="creation-guide"
          role="tabpanel"
          id="creation-panel-create"
          aria-labelledby="creation-tab-create"
        >
          <div className="creation-guide-intro">
            <h2 id="create-account-guide-title">Create one account</h2>
            <p>
              SuperAdmin and Admin only. Click <strong>Create</strong> and fill the form. Defaults
              are already filled in — change them if you need to.
            </p>
          </div>

          <ol className="creation-guide-steps">
            <li>
              <h3>Enter the mobile number</h3>
              <p>
                This is the only required field. Use 10 digits only for US, UK, or India. Do not add
                a country code, spaces, or an extension. Example: <code>9876543210</code>. It must
                be unique and cannot be changed later.
              </p>
            </li>

            <li>
              <h3>Review the defaults</h3>
              <p>
                The form starts with these values. You can change them before saving. If you clear a
                field, the default is used again.
              </p>
              <div className="creation-guide-table-wrap">
                <table className="creation-guide-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Role</td>
                      <td>
                        <code>User</code>
                      </td>
                    </tr>
                    <tr>
                      <td>Number of teams</td>
                      <td>
                        <code>1</code>
                      </td>
                    </tr>
                    <tr>
                      <td>No. of reboot</td>
                      <td>
                        <code>0</code>
                      </td>
                    </tr>
                    <tr>
                      <td>App configuration</td>
                      <td>
                        <code>1</code>
                      </td>
                    </tr>
                    <tr>
                      <td>Logout button</td>
                      <td>
                        <code>false</code>
                      </td>
                    </tr>
                    <tr>
                      <td>Offline</td>
                      <td>
                        <code>true</code>
                      </td>
                    </tr>
                    <tr>
                      <td>Source</td>
                      <td>
                        <code>curl</code>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </li>

            <li>
              <h3>Who can set what</h3>
              <ul>
                <li>
                  <strong>SuperAdmin</strong> can create accounts in any sanghat and assign any
                  role: User, Admin, SuperAdmin, or Developer.
                </li>
                <li>
                  <strong>Admin</strong> can only create <strong>User</strong> accounts in their own
                  sanghat.
                </li>
              </ul>
            </li>

            <li>
              <h3>If create fails</h3>
              <ul>
                <li>That phone number already exists</li>
                <li>The number is not 10 digits</li>
                <li>Your session expired — log in again</li>
                <li>Admins cannot create a non-User role or an account in another sanghat</li>
              </ul>
            </li>
          </ol>

          <section className="creation-faq" aria-labelledby="create-account-faq-title">
            <h2 id="create-account-faq-title">Create FAQ</h2>
            <p className="creation-faq-intro">Common questions about creating one account.</p>
            <div className="creation-faq-list">
              {CREATE_FAQ.map((item) => (
                <details key={item.question} className="solution-card">
                  <summary>{item.question}</summary>
                  <p className="creation-faq-answer">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </section>
      )}

      {tab === 'teams' && canUpdateTeamCounts && (
        <section
          className="creation-guide"
          role="tabpanel"
          id="creation-panel-teams"
          aria-labelledby="creation-tab-teams"
        >
          <div className="creation-guide-intro">
            <h2 id="update-teams-guide-title">Update teams</h2>
            <p>
              SuperAdmin and Developer only. Fill <strong>Updated No. of Teams Expected</strong> in
              the nivedan sheet (or <strong>No. of Teams Expected</strong> if that updated column is
              not in the file). This updates existing accounts — it does not create them.
            </p>
          </div>

          <ol className="creation-guide-steps">
            <li>
              <h3>Prepare the nivedan sheet</h3>
              <ul>
                <li>
                  Use a <strong>.xlsx</strong> nivedan file with a <strong>Mobile Number</strong>{' '}
                  column. Title rows above the header are ignored.
                </li>
                <li>
                  Fill <strong>Updated No. of Teams Expected</strong> with a whole number of 1 or
                  more.
                </li>
                <li>
                  If the updated column is not in the file, fill <strong>No. of Teams Expected</strong>{' '}
                  instead.
                </li>
                <li>
                  If the sheet has <strong>Updated No. of Teams Expected</strong>, that column is
                  required. An empty updated cell fails even when <strong>No. of Teams Expected</strong>{' '}
                  has a value.
                </li>
              </ul>
            </li>

            <li>
              <h3>Upload the file</h3>
              <ul>
                <li>Use a <strong>.xlsx</strong> file — not .xls or CSV</li>
                <li>Maximum size is <strong>20 MB</strong></li>
                <li>Upload one file at a time</li>
              </ul>
              <p>
                Click <strong>Update Teams</strong> and choose the file. The job is queued, then
                processed. Status moves from <code>queued</code> to <code>processing</code>, then{' '}
                <code>completed</code> or <code>failed</code>.
              </p>
            </li>

            <li>
              <h3>While the job runs</h3>
              <p>
                <strong>Updated</strong> is accounts updated, not accounts created. You can close the
                window and come back — the job continues in the background.
              </p>
              <p>
                Row errors do not fail the job. When status is <code>completed</code>, check the
                failed count. If it is greater than 0, open errors. Empty errors means every row
                updated.
              </p>
            </li>

            <li>
              <h3>If the whole job fails</h3>
              <p>The file could not be processed at all. Typical messages:</p>
              <div className="creation-guide-table-wrap">
                <table className="creation-guide-table">
                  <thead>
                    <tr>
                      <th>Message</th>
                      <th>Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {UPDATE_TEAMS_JOB_FAILURES.map((row) => (
                      <tr key={row.message}>
                        <td>
                          <code>{row.message}</code>
                        </td>
                        <td>{row.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>

            <li>
              <h3>Row errors</h3>
              <p>Failed rows are skipped. The rest still update.</p>
              <div className="creation-guide-table-wrap">
                <table className="creation-guide-table">
                  <thead>
                    <tr>
                      <th>Error</th>
                      <th>Cause</th>
                    </tr>
                  </thead>
                  <tbody>
                    {UPDATE_TEAMS_ROW_ERRORS.map((row) => (
                      <tr key={row.error}>
                        <td>
                          <code>{row.error}</code>
                        </td>
                        <td>{row.cause}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>

            <li>
              <h3>If the upload is rejected</h3>
              <ul>
                <li>No file uploaded, or the field name is not <code>file</code></li>
                <li>Only <strong>.xlsx</strong> files are supported</li>
                <li>Excel file must be smaller than 20 MB</li>
                <li>The uploaded file is not a valid .xlsx file</li>
                <li>Your account cannot perform this action (User / Admin)</li>
                <li>Import queue is unavailable — try again shortly</li>
              </ul>
            </li>
          </ol>

          <section className="creation-faq" aria-labelledby="update-teams-faq-title">
            <h2 id="update-teams-faq-title">FAQ</h2>
            <p className="creation-faq-intro">Common questions about updating teams.</p>
            <div className="creation-faq-list">
              {UPDATE_TEAMS_FAQ.map((item) => (
                <details key={item.question} className="solution-card">
                  <summary>{item.question}</summary>
                  <p className="creation-faq-answer">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </section>
      )}

      {showUpload && <BulkUploadDialog kind="accounts" onClose={() => setShowUpload(false)} />}

      {showUpdateTeams && (
        <BulkUploadDialog kind="teams" onClose={() => setShowUpdateTeams(false)} />
      )}

      {showCreate && (
        <CreateAccountDialog
          actor={account}
          onClose={() => setShowCreate(false)}
          onCreated={(message) => {
            setShowCreate(false)
            setStatus({ kind: 'success', text: message })
          }}
        />
      )}
    </div>
  )
}
