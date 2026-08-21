import { useState } from 'react'
import { downloadAccountBulkTemplate } from '../api/accounts'
import BulkUploadDialog from '../components/BulkUploadDialog'
import CreateAccountDialog from '../components/CreateAccountDialog'
import { canCreateAccounts, canEditPrivilegedAccountFields } from '../lib/roles'
import { getAccount, getToken } from '../lib/session'

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

export default function CreationPage() {
  const account = getAccount()
  const [showCreate, setShowCreate] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState('')
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  )

  const canBulkUpload = canEditPrivilegedAccountFields(account?.role)
  const canCreate = canCreateAccounts(account?.role)

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
          <p className="page-subtitle">Create accounts one at a time, or upload many from an Excel sheet.</p>
        </div>

        {(canBulkUpload || canCreate) && (
          <div className="page-actions">
            {canBulkUpload && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setStatus(null)
                  setShowUpload(true)
                }}
              >
                Bulk upload
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setStatus(null)
                  setShowCreate(true)
                }}
              >
                Create
              </button>
            )}
          </div>
        )}
      </div>

      {status && (
        <p className={status.kind === 'error' ? 'form-error' : 'form-success'}>{status.text}</p>
      )}

      {canBulkUpload && (
        <section className="creation-guide" aria-labelledby="bulk-upload-guide-title">
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

      {canCreate && (
        <section className="creation-guide" aria-labelledby="create-account-guide-title">
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

      {showUpload && <BulkUploadDialog onClose={() => setShowUpload(false)} />}

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
