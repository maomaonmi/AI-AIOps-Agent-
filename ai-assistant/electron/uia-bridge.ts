/**
 * UI Automation Bridge for Windows (v4 — 稳定版)
 *
 * 通过持久化 PowerShell 子进程调用 .NET System.Windows.Automation。
 * 全局扫描所有窗口的文本选区（不依赖焦点）。
 */

import { spawn, type ChildProcess } from 'node:child_process';

export interface UiaSelection {
  text: string;
  rect: { x: number; y: number; width: number; height: number };
  source: string;
}

const PS_SCRIPT = String.raw`
$ErrorActionPreference = "SilentlyContinue"
try { Add-Type -AssemblyName UIAutomationClient } catch {}

$root = [System.Windows.Automation.AutomationElement]::RootElement
$walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
$textPatternId = [System.Windows.Automation.AutomationPattern]::LookupById(10014)
$procIdProp = [System.Windows.Automation.AutomationProperty]::LookupById(30003)
$nameProp = [System.Windows.Automation.AutomationProperty]::LookupById(30005)
$classProp = [System.Windows.Automation.AutomationProperty]::LookupById(30012)
$myPid = $PID
$lastHash = ""
$cnt = 0

function Out($o) {
    [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
}

function B64($text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    return [Convert]::ToBase64String($bytes)
}

function Check($el, $d) {
    if ($d -gt 15) { return $null }
    try {
        $pat = $el.GetCurrentPattern($textPatternId)
        if ($pat) {
            $rs = $pat.GetSelection()
            if ($rs -and $rs.Count -gt 0) {
                $t = $rs[0].GetText(-1)
                if ($t -and $t.Trim()) { return @{E=$el;P=$pat;R=$rs[0];T=$t.Trim()} }
            }
        }
    } catch {}
    try {
        $c = $walker.GetFirstChild($el)
        while ($c) {
            $r = Check $c ($d+1)
            if ($r) { return $r }
            $c = $walker.GetNextSibling($c)
        }
    } catch {}
    return $null
}

function Poll {
    $found = $null
    $isPpt = $false
    $x=0;$y=0;$w=0;$h=0

    # 方案一：先单独识别 PPT 窗口，直接走 COM，不混用 UIA
    try {
        $pptProcs = Get-Process -Name POWERPNT -EA SilentlyContinue
        if ($pptProcs -and $pptProcs.Count -gt 0) { $isPpt = $true }
    } catch {}

    if ($isPpt) {
        Out @{_debug="PPT detected, using COM only..."}
        try {
            $ppt = [System.Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
            if ($ppt) {
                $sel = $ppt.ActiveWindow.Selection
                if ($sel) {
                    Out @{_debug="PPT COM: sel.Type=$($sel.Type)"}
                    # ppSelectionText=2, ppSelectionShapes=1, ppSelectionSlides=3, ppSelectionNone=0
                    if ($sel.Type -eq 2 -or $sel.Type -eq 1) {
                        if ($sel.Type -eq 2) {
                            $tr = $sel.TextRange
                        } else {
                            # 形状选择：尝试获取第一个形状的文本
                            try { $tr = $sel.ShapeRange(1).TextFrame.TextRange } catch { $tr = $null }
                        }
                        if ($tr -and $tr.Text -and $tr.Text.Trim()) {
                            $t = $tr.Text.Trim()
                            if ($t.Length -gt 50000) { $t = $t.Substring(0,50000) }
                            try {
                                $x=[int]$tr.BoundLeft;$y=[int]$tr.BoundTop
                                $w=[int]$tr.BoundWidth;$h=[int]$tr.BoundHeight
                            } catch {}
                            Out @{_debug="OK cnt=$cnt src=POWERPNT(COM) len=$t.length"}
                            return @{b64=(B64 $t);x=$x;y=$y;w=$w;h=$h;s="POWERPNT"}
                        }
                    }
                }
            }
        } catch { Out @{_debug="PPT COM error: $_"} }
        Out @{_e=1}
        return
    }

    $win = $walker.GetFirstChild($root)
    while ($win -and -not $found) {
        # 跳过自己的进程；浏览器窗口现在允许扫描，用于支持网页选区
        $skip = $false
        try {
            $wPid = $win.GetCurrentPropertyValue($procIdProp)
            if ($wPid -eq $myPid) { $skip = $true }
        } catch {}
        if (-not $skip) {
            try { $found = Check $win 0 } catch {}
        }
        try { $win = $walker.GetNextSibling($win) } catch { $win = $null }
    }
    if (-not $found) { Out @{_e=1}; return }

        $t = $found.T
        if ($t.Length -gt 50000) { $t = $t.Substring(0,50000) }

        # 优先用 BoundingRectangle 属性；Chrome/Edge 的 TextPattern range 有时 GetBoundingRectangles 为空
        $x=0;$y=0;$w=0;$h=0
        try {
            $br = $found.R.BoundingRectangle
            if ($br -and $br.Width -gt 0 -and $br.Height -gt 0) {
                $x=[int]$br.X;$y=[int]$br.Y
                $w=[int]$br.Width;$h=[int]$br.Height
            }
        } catch {}
        if ($w -eq 0 -or $h -eq 0) {
            $rc = $found.R.GetBoundingRectangles()
            if ($rc -and $rc.Count -ge 1) {
                $r = $rc[0]
                if ($r -is [System.Windows.Rect]) {
                    $x=[int]$r.X;$y=[int]$r.Y
                    $w=[int]$r.Width;$h=[int]$r.Height
                }
            }
        }

        $pn = "?"
        $title = ""
        $cls = ""
        $owner = $found.E
        for ($i = 0; $i -lt 8 -and $owner; $i++) {
            try {
                $pi = $owner.GetCurrentPropertyValue($procIdProp)
                if ($pi -gt 0) {
                    $p = Get-Process -Id $pi -EA SilentlyContinue
                    if ($p) { $pn = $p.ProcessName }
                }
                try { $title = [string]$owner.GetCurrentPropertyValue($nameProp) } catch {}
                try { $cls = [string]$owner.GetCurrentPropertyValue($classProp) } catch {}
                if (($pn -ne "?" -and $pn) -or ($title -and $title.Trim()) -or ($cls -and $cls.Trim())) { break }
                $owner = $walker.GetParent($owner)
            } catch { break }
        }

        $src = $pn
        if ($pn -match 'chrome|msedge|firefox|brave|opera|vivaldi|browser|webview') { $src = "WEB($pn)" }
        elseif ($title -match ' - Google Chrome$' -or $title -match ' - Microsoft Edge$' -or $title -match ' - Mozilla Firefox$') { $src = "WEB($pn)" }
        elseif ($cls -match 'Chrome_Widget|MozillaWindowClass|ApplicationFrameWindow|CefWebView') { $src = "WEB($pn)" }
        if ($title) { $src = "$src ($title)" }
        if (-not $src -or $src -eq "?" ) { $src = "unknown" }

        Out @{_debug="OK cnt=$cnt src=$src pn=$pn cls=$cls title=$title len=$t.length rect=($x,$y,$w,$h)"}
        return @{b64=(B64 $t);x=$x;y=$y;w=$w;h=$h;s=$src}
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Out @{_status="ready"}

while ($true) {
    $line = ""
    try { $line = [Console]::In.ReadLine() } catch { break }
    $cmd = "$line".Trim()
    switch ($cmd) {
        "poll" { $cnt++; $r = Poll; if (-not $r) { Out @{_e=1} } else { $h=$r.b64; if ($h -ne $lastHash) { $lastHash=$h; Out $r } else { Out @{_s=1} } } }
        "exit" { Out @{_status="exiting"}; exit 0 }
        default { Out @{_e=1} }
    }
}
`;

export class UiaBridge {
  private ps: ChildProcess | null = null;
  private ready = false;
  private buffer = '';
  private queue: Array<(val: Record<string, unknown> | null) => void> = [];

  async init(): Promise<boolean> {
    if (this.ps && !this.ps.killed) return this.ready;

    return new Promise((resolve) => {
      try {
        this.ps = spawn('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
          '-Command', PS_SCRIPT,
        ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });

        const proc = this.ps;
        proc.stdout?.setEncoding('utf8');
        proc.stderr?.setEncoding('utf8');

        proc.stderr?.on('data', (c: string) => {
          const m = c.trim();
          if (m && !m.startsWith('WARNING') && !m.startsWith('PS')) console.warn('[uia] stderr:', m.slice(0, 200));
        });

        proc.stdout?.on('data', (chunk: string) => {
          this.buffer += chunk;
          const lines = this.buffer.split('\n');
          this.buffer = lines.pop() ?? '';
          for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;
            let data: Record<string, unknown>;
            try { data = JSON.parse(line); } catch { continue; }

            // _status=ready 必须优先处理
            if (data._status === 'ready') {
              this.ready = true;
              console.log('[uia] ready');
              continue;
            }
            // _debug 只打印不消费回调
            if (data._debug) {
              console.log(`[uia] ${data._debug}`);
              continue;
            }
            const cb = this.queue.shift();
            if (cb) cb(data);
          }
        });

        proc.on('error', () => { this.ready = false; this.drain(null); resolve(false); });
        proc.on('exit', () => { this.ready = false; this.ps = null; this.drain(null); });
        setTimeout(() => resolve(this.ready), 3000);
      } catch { resolve(false); }
    });
  }

  private send(cmd: string, ms = 1500): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      if (!this.ps || this.ps.killed || !this.ready) { resolve(null); return; }
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; const i = this.queue.indexOf(cb); if (i >= 0) this.queue.splice(i, 1); resolve(null); } }, ms);
      const cb = (d: Record<string, unknown> | null) => { if (!done) { done = true; clearTimeout(timer); resolve(d); } };
      this.queue.push(cb);
      this.ps.stdin!.write(cmd + '\n');
    });
  }

  private drain(v: Record<string, unknown> | null) { while (this.queue.length) (this.queue.shift())!(v); }

  async poll(): Promise<{ changed: boolean; selection: UiaSelection | null }> {
    const d = await this.send('poll');
    if (!d || d._e || d._s || d._error) return { changed: false, selection: null };
    // 从 Base64 解码文本
    let text = '';
    try {
      text = Buffer.from(String(d.b64 ?? ''), 'base64').toString('utf-8');
    } catch { text = ''; }
    return {
      changed: true,
      selection: {
        text,
        rect: { x: Number(d.x ?? 0), y: Number(d.y ?? 0), width: Number(d.w ?? 0), height: Number(d.h ?? 0) },
        source: String(d.s ?? 'unknown'),
      },
    };
  }

  isAvailable() { return this.ready && !!this.ps && !this.ps.killed; }

  dispose() {
    if (this.ps && !this.ps.killed) {
      this.send('exit', 500).finally(() => setTimeout(() => { this.ps?.kill(); this.ps = null; }, 300));
    }
  }
}

export const uiaBridge = new UiaBridge();
