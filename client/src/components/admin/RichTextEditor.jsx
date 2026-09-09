import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Undo2,
  Redo2,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Table as TableIcon,
  Minus,
  Omega,
  Maximize2,
  Minimize2,
  Code,
  Bold,
  Italic,
  Strikethrough,
  RemoveFormatting,
  ListOrdered,
  List,
  IndentDecrease,
  IndentIncrease,
  Quote,
} from 'lucide-react'

/**
 * The journal post body editor — `<textarea id="content">` with `CKEDITOR.replace('content')`
 * over it in blog-posts/edit.blade.php.
 *
 * NOT a port of CKEditor. The Blade pulls 4.22.1 off cdn.ckeditor.com, and that build prints
 * its own "This CKEditor 4.22.1 version is not secure" banner into the editing area — it is
 * end-of-life. Re-adding it here would mean a third-party script tag in an app that has just
 * had its whole vendor stack removed, running unpatched code against an authenticated admin
 * session. So the toolbar is reproduced and the editor behind it is local.
 *
 * The clipboard row of the original (Cut / Copy / Paste / Paste as text / Paste from Word) is
 * left out: browsers refuse those commands from a script, so in the Laravel panel they only
 * ever opened a "your browser doesn't allow" dialog. Ctrl/Cmd-X, C and V work as they always
 * did. Spell check is likewise the browser's own.
 *
 * Content is HTML in both directions, so existing post bodies load and save unchanged.
 */

/** Editing commands. `execCommand` is deprecated but is what every contenteditable uses. */
const exec = (command, value = null) => {
  document.execCommand(command, false, value)
}

const SPECIAL_CHARS = [
  '€', '£', '¥', '¢', '©', '®', '™', '°', '±', '×', '÷', '¼', '½', '¾',
  '‘', '’', '“', '”', '–', '—', '…', '•', '·', '«', '»', '≤', '≥', '≠',
  'á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', 'ç', 'ø', 'å', 'æ', 'ß', '→', '★',
]

const FORMATS = [
  { value: 'p', label: 'Normal' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'h5', label: 'Heading 5' },
  { value: 'h6', label: 'Heading 6' },
  { value: 'pre', label: 'Formatted' },
]

function ToolButton({ title, onClick, active, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      // The mousedown guard keeps the caret in the editable area; without it the
      // selection is lost the moment the button takes focus and the command applies
      // to nothing.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex size-[26px] items-center justify-center rounded border text-[#333] transition-colors ${
        active
          ? 'border-[#b6b6b6] bg-[#e4e4e4]'
          : 'border-transparent hover:border-[#d1d1d1] hover:bg-[#eaeaea]'
      }`}
    >
      {children}
    </button>
  )
}

/** The 1px rule CKEditor draws between toolbar groups. */
const Divider = () => <span className="mx-1 h-[18px] w-px shrink-0 bg-[#d3d3d3]" aria-hidden="true" />

export default function RichTextEditor({ value = '', onChange, rows = 12, id }) {
  const bodyRef = useRef(null)
  const [source, setSource] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [chars, setChars] = useState(false)
  const [prompt, setPrompt] = useState(null)
  const [promptValue, setPromptValue] = useState('')
  const [marks, setMarks] = useState({})
  const savedRange = useRef(null)

  // Writing innerHTML on every render would reset the caret on each keystroke, so the
  // editable area is uncontrolled and only re-synced when the value differs from what it
  // already holds — i.e. when the post loads, or after a source-mode edit.
  useEffect(() => {
    const el = bodyRef.current
    if (!el || source) return
    if (el.innerHTML !== value) el.innerHTML = value ?? ''
  }, [value, source])

  const emit = useCallback(() => {
    if (bodyRef.current) onChange?.(bodyRef.current.innerHTML)
  }, [onChange])

  /** Which inline marks apply at the caret, so the buttons can show their pressed state. */
  const refreshMarks = useCallback(() => {
    if (source) return
    try {
      setMarks({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      })
    } catch {
      setMarks({})
    }
  }, [source])

  const run = useCallback(
    (command, arg) => {
      bodyRef.current?.focus()
      exec(command, arg)
      emit()
      refreshMarks()
    },
    [emit, refreshMarks],
  )

  /** Insert arbitrary HTML at the caret, restoring the selection a popover stole. */
  const insertHtml = useCallback(
    (html) => {
      bodyRef.current?.focus()
      const selection = window.getSelection()
      if (savedRange.current && selection) {
        selection.removeAllRanges()
        selection.addRange(savedRange.current)
      }
      exec('insertHTML', html)
      emit()
    },
    [emit],
  )

  const rememberSelection = () => {
    const selection = window.getSelection()
    savedRange.current = selection && selection.rangeCount ? selection.getRangeAt(0) : null
  }

  function openPrompt(kind) {
    rememberSelection()
    setPromptValue('')
    setPrompt(kind)
  }

  function submitPrompt(event) {
    event.preventDefault()
    const url = promptValue.trim()
    setPrompt(null)
    if (!url) return

    if (prompt === 'link') {
      bodyRef.current?.focus()
      const selection = window.getSelection()
      if (savedRange.current && selection) {
        selection.removeAllRanges()
        selection.addRange(savedRange.current)
      }
      // An empty selection has nothing to wrap, so the URL becomes its own label.
      if (selection?.isCollapsed) {
        insertHtml(`<a href="${escapeAttribute(url)}">${escapeText(url)}</a>`)
      } else {
        run('createLink', url)
      }
    } else {
      insertHtml(`<img src="${escapeAttribute(url)}" alt="">`)
    }
  }

  function insertTable() {
    const cells = '<td><br></td>'.repeat(3)
    const rowsHtml = `<tr>${cells}</tr>`.repeat(3)
    insertHtml(
      `<table border="1" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;"><tbody>${rowsHtml}</tbody></table><p><br></p>`,
    )
  }

  const shell = maximized
    ? 'fixed inset-0 z-[1200] flex flex-col bg-white'
    : 'flex flex-col rounded border border-[#d1d1d1] bg-white'

  return (
    <div className={shell}>
      {/* CKEditor's `.cke_top` — two button rows on #f8f8f8 above the editing area */}
      <div className="shrink-0 border-b border-[#d1d1d1] bg-[#f8f8f8] px-1.5 py-1">
        <div className="flex flex-wrap items-center gap-0.5 pb-1">
          <ToolButton title="Undo" onClick={() => run('undo')}><Undo2 size={14} /></ToolButton>
          <ToolButton title="Redo" onClick={() => run('redo')}><Redo2 size={14} /></ToolButton>
          <Divider />
          <ToolButton title="Link" onClick={() => openPrompt('link')}><LinkIcon size={14} /></ToolButton>
          <ToolButton title="Unlink" onClick={() => run('unlink')}><Unlink size={14} /></ToolButton>
          <Divider />
          <ToolButton title="Image" onClick={() => openPrompt('image')}><ImageIcon size={14} /></ToolButton>
          <ToolButton title="Table" onClick={insertTable}><TableIcon size={14} /></ToolButton>
          <ToolButton title="Horizontal line" onClick={() => run('insertHorizontalRule')}><Minus size={14} /></ToolButton>
          <ToolButton
            title="Insert special character"
            active={chars}
            onClick={() => { rememberSelection(); setChars((v) => !v) }}
          >
            <Omega size={14} />
          </ToolButton>
          <Divider />
          <ToolButton
            title={maximized ? 'Minimize' : 'Maximize'}
            active={maximized}
            onClick={() => setMaximized((v) => !v)}
          >
            {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </ToolButton>
          <ToolButton
            title="Source"
            active={source}
            onClick={() => setSource((v) => !v)}
          >
            <Code size={14} />
          </ToolButton>
        </div>

        <div className="flex flex-wrap items-center gap-0.5 border-t border-[#e4e4e4] pt-1">
          <ToolButton title="Bold" active={marks.bold} onClick={() => run('bold')}><Bold size={14} /></ToolButton>
          <ToolButton title="Italic" active={marks.italic} onClick={() => run('italic')}><Italic size={14} /></ToolButton>
          <ToolButton title="Strikethrough" active={marks.strikeThrough} onClick={() => run('strikeThrough')}><Strikethrough size={14} /></ToolButton>
          <ToolButton title="Remove format" onClick={() => run('removeFormat')}><RemoveFormatting size={14} /></ToolButton>
          <Divider />
          <ToolButton title="Insert/Remove Numbered List" active={marks.insertOrderedList} onClick={() => run('insertOrderedList')}><ListOrdered size={14} /></ToolButton>
          <ToolButton title="Insert/Remove Bulleted List" active={marks.insertUnorderedList} onClick={() => run('insertUnorderedList')}><List size={14} /></ToolButton>
          <Divider />
          <ToolButton title="Decrease Indent" onClick={() => run('outdent')}><IndentDecrease size={14} /></ToolButton>
          <ToolButton title="Increase Indent" onClick={() => run('indent')}><IndentIncrease size={14} /></ToolButton>
          <Divider />
          <ToolButton title="Block Quote" onClick={() => run('formatBlock', 'blockquote')}><Quote size={14} /></ToolButton>
          <Divider />
          <select
            aria-label="Paragraph Format"
            value=""
            onMouseDown={rememberSelection}
            onChange={(event) => {
              if (event.target.value) run('formatBlock', event.target.value)
              event.target.value = ''
            }}
            className="h-[26px] rounded border border-[#d1d1d1] bg-white px-1.5 text-[12px] text-[#333] outline-none"
          >
            <option value="">Format</option>
            {FORMATS.map((format) => (
              <option key={format.value} value={format.value}>{format.label}</option>
            ))}
          </select>
        </div>

        {prompt ? (
          <form onSubmit={submitPrompt} className="flex flex-wrap items-center gap-2 border-t border-[#e4e4e4] pt-1.5">
            <label className="text-[12px] font-semibold text-[#555]">
              {prompt === 'link' ? 'Link URL' : 'Image URL'}
            </label>
            <input
              type="text"
              autoFocus
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              placeholder={prompt === 'link' ? 'https:// or /journal/slug' : 'https://…'}
              className="h-[28px] min-w-[220px] flex-1 rounded border border-[#d1d1d1] bg-white px-2 text-[13px] outline-none"
            />
            <button type="submit" className="h-[28px] rounded bg-admin-primary px-3 text-[12px] font-semibold text-white">
              Insert
            </button>
            <button
              type="button"
              onClick={() => setPrompt(null)}
              className="h-[28px] rounded border border-[#d1d1d1] bg-white px-3 text-[12px] font-semibold text-[#555]"
            >
              Cancel
            </button>
          </form>
        ) : null}

        {chars ? (
          <div className="flex flex-wrap gap-1 border-t border-[#e4e4e4] pt-1.5">
            {SPECIAL_CHARS.map((char) => (
              <button
                key={char}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { insertHtml(char); setChars(false) }}
                className="inline-flex size-[26px] items-center justify-center rounded border border-[#d1d1d1] bg-white text-[13px] text-[#333] hover:bg-[#eaeaea]"
              >
                {char}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {source ? (
        <textarea
          id={id}
          value={value ?? ''}
          onChange={(event) => onChange?.(event.target.value)}
          spellCheck={false}
          className="w-full flex-1 resize-y border-none bg-white p-3 font-mono text-[13px] leading-[1.5] text-[#333] outline-none"
          style={maximized ? undefined : { minHeight: `${rows * 22}px` }}
        />
      ) : (
        <div
          id={id}
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={emit}
          onBlur={emit}
          onKeyUp={refreshMarks}
          onMouseUp={refreshMarks}
          className="admin-rte w-full flex-1 overflow-auto bg-white p-3 text-[14px] leading-[1.6] text-[#333] outline-none"
          style={maximized ? undefined : { minHeight: `${rows * 22}px`, resize: 'vertical' }}
        />
      )}
    </div>
  )
}

const escapeAttribute = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const escapeText = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
