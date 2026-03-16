# anvil_client.py
# Handles all communication between the client and the backend (Anvil Integration)

from ._anvil_designer import CombinedTemplate
from anvil import *
import anvil.server
from anvil import js
import json
import base64
import time


class Combined(CombinedTemplate):

  def __init__(self, **properties):
    self.init_components(**properties)
    self.reset_session()

    filepath = "_/theme/src/index.html"
    html_panel = HtmlPanel(html=f"""
                <style>
                    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                    body, html {{ margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }}
                    #ips-studio {{
                        position: fixed; top: 0; left: 0;
                        width: 100vw; height: 100vh;
                        border: none; display: block;
                        margin: 0; padding: 0; z-index: 1;
                    }}
                </style>
                <!-- <iframe src="{filepath}" id="ips-studio"></iframe> -->
                <iframe src="{filepath}" id="ips-studio" allow="file-system-access"></iframe>

                <script>
                    window.anvilIframeMessages = [];

                    window.sendMessageToIframe = function(messageData) {{
                        var iframe = document.getElementById('ips-studio');
                        if (iframe && iframe.contentWindow) {{
                            iframe.contentWindow.postMessage(messageData, '*');
                        }}
                    }};

                    window.addEventListener('message', function(event) {{
                        console.log('Message received from iframe:', event.data);

                        if (event.data && event.data.type === 'request_csv_data') {{
                            var fetchBtn = document.querySelector('button');
                            if (fetchBtn && fetchBtn.textContent.includes('Fetch CSV')) {{
                                fetchBtn.click();
                            }} else {{
                                window.dispatchEvent(new CustomEvent('anvilFetchCsv', {{detail: event.data}}));
                            }}
                        }}
                        if (event.data && event.data.type === 'request_antenna_configs')
                            window.dispatchEvent(new CustomEvent('anvilFetchAntennaConfigs', {{detail: event.data}}));
                        if (event.data && event.data.type === 'start_optimization_and_poll')
                            window.dispatchEvent(new CustomEvent('anvilStartOptimizationAndPoll', {{detail: event.data}}));
                        if (event.data && (event.data.type === 'start_accurate_baseline'))
                            window.dispatchEvent(new CustomEvent('anvilStartAccurateBaseline', {{detail: event.data}}));
                        
                        if (event.data && event.data.type === 'save_json_file') {{
                            window.anvilIframeMessages.push(event.data);
                            triggerMessageCheck();
                        }}
                        if (event.data && event.data.type === 'upload_antenna_pattern')
                            window.dispatchEvent(new CustomEvent('anvilUploadAntennaPattern', {{detail: event.data}}));
                        if (event.data && event.data.type === 'antenna_status_update')
                            window.dispatchEvent(new CustomEvent('anvilAntennaStatusUpdate', {{detail: event.data}}));
                        if (event.data && event.data.type === 'antennas_batch_status_update')
                            window.dispatchEvent(new CustomEvent('anvilAntennasBatchStatusUpdate', {{detail: event.data}}));
                        if (event.data && event.data.type === 'antenna_configs_update')
                            window.dispatchEvent(new CustomEvent('anvilAntennaConfigsUpdate', {{detail: event.data}}));
                        if (event.data && event.data.type === 'anvil_alert')
                            window.dispatchEvent(new CustomEvent('anvilAlert', {{detail: event.data}}));
                        if (event.data && event.data.type === 'anvil_confirm')
                            window.dispatchEvent(new CustomEvent('anvilConfirm', {{detail: event.data}}));
                        if (event.data && event.data.type === 'generate_dxf')
                            window.dispatchEvent(new CustomEvent('anvilGenerateDxf', {{detail: event.data}}));
                        if (event.data && event.data.type === 'parse_dxf_request')
                            window.dispatchEvent(new CustomEvent('anvilParseDxf', {{detail: event.data}}));
                        if (event.data && event.data.type === 'compliance_settings')
                            window.dispatchEvent(new CustomEvent('anvilComplianceSettings', {{detail: event.data}}));
                        if (event.data && event.data.type === 'restart_backend_session')
                            window.dispatchEvent(new CustomEvent('anvilRestartSession', {{detail: event.data}}));
                        if (event.data && event.data.type === 'request_app_version')
                            window.dispatchEvent(new CustomEvent('anvilGetAppVersion', {{detail: event.data}}));
                        if (event.data && event.data.type === 'set_send_live_rsrp')
                            window.dispatchEvent(new CustomEvent('anvilSetSendLiveRsrp', {{detail: event.data}}));
                    }});

                    function triggerMessageCheck() {{
                        var buttons = document.querySelectorAll('button');
                        for (var i = 0; i < buttons.length; i++) {{
                            if (buttons[i].textContent.trim() === 'Check Messages') {{
                                buttons[i].click();
                                return;
                            }}
                        }}
                    }}

                    setInterval(function() {{
                        if (window.anvilIframeMessages.length > 0) triggerMessageCheck();
                    }}, 100);

                    console.log('Message listener set up for iframe');
                </script>
            """)

    self.add_component(html_panel)
    js.window.addEventListener("anvilStartOptimizationAndPoll", self.start_optimization)
    js.window.addEventListener("anvilStartAccurateBaseline", self.get_accurate_baseline)
    js.window.addEventListener("anvilAntennaStatusUpdate", self.send_antenna_config)
    js.window.addEventListener("anvilAntennasBatchStatusUpdate", self.add_batch_antennas)
    js.window.addEventListener("anvilUploadAntennaPattern", self.send_pattern_to_server)
    js.window.addEventListener("anvilGenerateDxf", self.generate_dxf)
    js.window.addEventListener("anvilParseDxf", self.parse_dxf)
    js.window.addEventListener("anvilComplianceSettings", self.update_compliance_settings)
    js.window.addEventListener("anvilRestartSession", self.reset_session)
    js.window.addEventListener("anvilGetAppVersion", self.send_app_version)
    js.window.addEventListener("anvilSetSendLiveRsrp", self.set_send_live_rsrp)

    # ========== Core Iframe Communication ==========
  def _send_to_iframe(self, msg_type, success=None, **kwargs):
    """Single entry point for ALL communication to the iframe."""
    data = {"type": msg_type}
    if success is not None:
      data["success"] = success
    data.update(kwargs)
    js.window.sendMessageToIframe(data)

  def set_send_live_rsrp(self, event):
    """Called when JS sends set_send_live_rsrp (e.g. Accurate Engine model selected)."""
    enabled = False
    if hasattr(event, "detail") and event.detail:
      enabled = event.detail.get("enabled", False)
    self.enable_live_rsrp = enabled
    if not enabled:
      return
    try:
      with anvil.server.no_loading_indicator:
        result = anvil.server.call("set_enable_live_rsrp_flag", enabled)
        if result.get("status") == "success":
          print(f"Enable live rsrp in backend")
        else:
          print(f"set_send_live_rsrp failed: {result.get('message', 'Unknown error')}")
    except Exception as e:
      print(f"[RSRP] set_send_live_rsrp failed: {e}")

  def _send_error(self, msg_type, technical_error, request_id=None):
    """Log raw error to console, send friendly message to iframe."""
    if not technical_error:
      friendly_msg = "An unexpected error occurred."  # Please try again later."
    else:
      technical_lower = str(technical_error).lower()
      if "uplink disconnected" in technical_lower or "no response" in technical_lower:
        friendly_msg = "The link to the optimization server was lost. Please check your connection."
      elif "baseline" in technical_lower:
        friendly_msg = "Baseline setup failed. Please ensure baseline data is correctly loaded."
      elif "busy" in technical_lower or "already running" in technical_lower:
        friendly_msg = "An optimization is already in progress. Please wait for it to finish."
      elif "no antennas" in technical_lower:
        friendly_msg = "No antennas found for optimization. Please add at least one antenna."
      elif "unsupported file type" in technical_lower:
        friendly_msg = "Unsupported file type. Please upload .txt or .msi files only."
      elif "no file content" in technical_lower:
        friendly_msg = "The uploaded file appears to be empty."
      elif "no image provided" in technical_lower:
        friendly_msg = "Floorplan image is required for DXF generation."
      elif "dxf" in technical_lower:
        friendly_msg = "An error occurred while processing the DXF file."
      elif "antenna" in technical_lower:
        friendly_msg = "An error occurred while updating the antenna configuration."
      elif "compliance" in technical_lower:
        friendly_msg = "Could not update compliance settings."
      else:
        friendly_msg = "An unexpected error occurred."  # Please try again later."

    print(f"[ERROR] {technical_error}")
    self._send_to_iframe(msg_type, success=False, error=friendly_msg, requestId=request_id)

    # ========== Antenna Pattern Upload ==========
  def send_pattern_to_server(self, event):
    event_data = getattr(event, "data", None) or getattr(event, "detail", None) # list of dict
    print(f"[INFO] Data list: {type(event_data['files'])}")
    if not event_data: #or not isinstance(data_list, list):
      # self._send_error("upload_antenna_pattern_response", "No data received for pattern upload")
      return

    msg_type = getattr(event_data, "type", None) or (event_data.get("type") if hasattr(event_data, "get") else None)
    if msg_type != "upload_antenna_pattern":
      self._send_error("upload_antenna_pattern_response", "Invalid message type for pattern upload")
      return

    for data in event_data['files']:

      filename = getattr(data, "filename", None) or (data.get("filename") if hasattr(data, "get") else "uploaded_pattern.txt")
      if not (filename.lower().endswith(".txt") or filename.lower().endswith(".msi")):
        self._send_error("upload_antenna_pattern_response", f"Unsupported file type: {filename}")
        return

      file_content = getattr(data, "content", None) or (data.get("content") if hasattr(data, "get") else None)
      if not file_content:
        self._send_error("upload_antenna_pattern_response", "No file content received for pattern upload")
        return

      if isinstance(file_content, str) and "," in file_content:
        _, encoded = file_content.split(",", 1)
        media_obj = anvil.BlobMedia("text/plain", base64.b64decode(encoded), filename)
      elif isinstance(file_content, str):
        media_obj = anvil.BlobMedia("text/plain", file_content.encode("utf-8"), filename)
      else:
        media_obj = anvil.BlobMedia("text/plain", file_content, filename)

      with anvil.server.no_loading_indicator:
        result = anvil.server.call("upload_antenna_pattern", media_obj)

      if result.get("status") == "success":
        print(f"[SUCCESS] Pattern {result.get('pattern_name')} uploaded.")
        self._send_to_iframe("upload_antenna_pattern_response", success=True, pattern_name=result.get("pattern_name"), filename=result.get("filename"))
      else:
        self._send_error("upload_antenna_pattern_response", result.get("message", "Unknown error during upload"))


    # ========== Antenna Config / Batch ==========

  def _transform_antenna_data(self, antenna_data):
    enabled_value = antenna_data.get("enabled", True)
    if isinstance(enabled_value, str):
      enabled_value = enabled_value.lower() in ("true", "1", "yes", "on")
    elif enabled_value is None:
      enabled_value = True

    clean_pattern = "".join(c for c in antenna_data.get("antennaPatternFileName", "") if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")

    return {
      "Az_BL": antenna_data.get("azimuth", 0),
      "Tilt_BL": antenna_data.get("tilt", 0),
      "power(antenna)_BL": antenna_data.get("tx", 18),
      "Antenna_Pattern_Name": f"{clean_pattern}.xlsx",
      "X_antenna": antenna_data.get("x", ""),
      "Y_antenna": antenna_data.get("y", ""),
      "Z_antenna": antenna_data.get("z", 2.5),
      "Turning_ON_OFF": enabled_value,
    }

  def send_antenna_config(self, event):
    antenna_data = event.detail.get("antenna") if hasattr(event, "detail") else event.detail
    request_id = event.detail.get("requestId") if hasattr(event, "detail") else None
    ant_id = antenna_data.get("id") if antenna_data else None
    print(f"[RSRP] send_antenna_config received ant_id={ant_id} enable_live_rsrp={getattr(self, 'enable_live_rsrp', False)}")

    if not antenna_data:
      self._send_error("antenna_status_response", "No antenna data in status update", request_id=request_id)
      return

    ant_id = antenna_data.get("id")
    if not ant_id:
      self._send_error("antenna_status_response", "No antenna ID in status update", request_id=request_id)
      return

    ant_config = self._transform_antenna_data(antenna_data)
    print(f"Antenna update: {ant_id} - enabled: {ant_config.get('Turning_ON_OFF')}")

    with anvil.server.no_loading_indicator:
      result = anvil.server.call("enqueue_antenna", ant_id, ant_config)

    if not result:
      self._send_error("antenna_status_response", "No response from backend", request_id=request_id)
      return

    state = result.get("state")
    if state == "optimization_running":
      self._send_error("antenna_status_response", f"Optimization is running - cannot modify antenna {ant_id}", request_id=request_id)
      return
    elif state == "update_failed":
      self._send_error("antenna_status_response", f"Update failed: {result.get('error', 'Unknown error')}", request_id=request_id)
      return

    print(f"[SUCCESS] Antenna {ant_id} {state}")
    self._send_to_iframe("antenna_status_response", success=True, requestId=request_id)

    # Live RSRP only for single-ant config (ant-by-ant), not for batch
    if self.enable_live_rsrp and state in ("added", "updated"):
      self._pending_rsrp_ant_id = ant_id
      self._pending_rsrp_timestamp = time.time()
      print(f"[RSRP] Pending RSRP fetch for ant_id={ant_id} (enable_live_rsrp={self.enable_live_rsrp})")
    else:
      if state in ("added", "updated"):
        print(f"[RSRP] Skipped pending (enable_live_rsrp={self.enable_live_rsrp})")

  def add_batch_antennas(self, event):
    print("Iframe sent batch antenna configs...")
    request_id = event.detail.get("requestId") if hasattr(event, "detail") else None
    antennas = event.detail.get("antennas") if hasattr(event, "detail") else []

    self._send_to_iframe("antennas_batch_status_response", success=True, requestId=request_id)

    if not antennas:
      self._send_error("antennas_batch_status_response", "No antennas in configs update", request_id=request_id)
      return

    ants_ids, ants_configs, pattern = [], [], None
    for ant in antennas:
      ant_id = ant.get("id")
      if not ant_id:
        continue
      ants_ids.append(ant_id)
      ant_config = self._transform_antenna_data(ant)
      if pattern is None:
        pattern = ant_config["Antenna_Pattern_Name"].replace(".txt", "")
      ants_configs.append(ant_config)

    with anvil.server.no_loading_indicator:
      anvil.server.call("process_batch_antennas", pattern, ants_ids, ants_configs)

    print(f"[SUCCESS] Added {len(ants_ids)} antenna(s) from batch update")

    # ========== Optimization ==========
  def get_accurate_baseline(self, event):
    if self.opt_running:
      self._send_to_iframe("baseline_error", success=False, message="Optimization is currently running")
      return

    with anvil.server.no_loading_indicator:
      baseline_check = anvil.server.call("check_baseline_exists")
      if not baseline_check.get("exists", False):
        self._send_error("baseline_error", "No baseline initialized! Please ensure baseline is loaded before calculating accurate baseline.")
        return

    with anvil.server.no_loading_indicator:
      result = anvil.server.call("get_accurate_baseline")

    status = result.get("status")
    if status == "success":
      with anvil.server.no_loading_indicator:
        live = anvil.server.call("get_live_optimization", 0, 0, 0)
        self._send_to_iframe("optimization_update",
                             new_action_configs=[],
                             new_bsrv_rsrp=live.get("new_bsrv_rsrp", []),
                             new_compliance=live.get("new_compliance", []),
                             status="finished",
                             message="Accurate Baseline",
                             rsrp_send_timestamp_sec=live.get("rsrp_send_timestamp_sec"))
      self._send_to_iframe("baseline_completed", success=True, message="Accurate baseline calculated successfully")
    else:
      self._send_error("baseline_error", result.get("message", "Error calculating accurate baseline"))

  @handle("opt_timer", "tick")
  def opt_timer_tick(self, **event_args):
    """Optimization polling: fetches live actions/RSRP/compliance while optimization runs."""
    if self.opt_running:
      self.poll_optimization_data(**event_args)

  @handle("ant_rsrp_timer", "tick")
  def ant_rsrp_timer_tick(self, **event_args):
    if self.enable_live_rsrp:
      self.poll_live_rsrp(**event_args)

  def poll_live_rsrp(self, **event_args):
    """Poll backend for live RSRP: when RSRP arrives, send to iframe and clear pending."""
    ant_id = getattr(self, "_pending_rsrp_ant_id", None)
    if not ant_id:
      return
    ts = getattr(self, "_pending_rsrp_timestamp", 0)
    elapsed = time.time() - ts
    if elapsed > 10:
      print(f"[RSRP] Poll timeout for ant_id={ant_id} after {elapsed:.1f}s")
      self._pending_rsrp_ant_id = None
      self._pending_rsrp_timestamp = None
      return
    try:
      with anvil.server.no_loading_indicator:
        result = anvil.server.call("get_live_rsrp", ant_id, evict=True)
      if result and ant_id in result:
        rsrp_len = len(result[ant_id].get("rsrp", []))
        print(f"[RSRP] Got RSRP for ant_id={ant_id} ({rsrp_len} values), sending to iframe")
        self._pending_rsrp_ant_id = None
        self._pending_rsrp_timestamp = None
        self._send_to_iframe(
          "live_rsrp",
          ant_id=ant_id,
          rsrp=result[ant_id]["rsrp"],
          config=result[ant_id].get("config"),
        )
        # else: backend not ready yet, will retry next tick
    except Exception as e:
      print(f"[RSRP] get_live_rsrp failed: {e}")

  def start_optimization(self, event):
    if self.opt_running:
      self._send_to_iframe("optimization_started", success=False, message="Optimization already running")
      return

    with anvil.server.no_loading_indicator:
      baseline_check = anvil.server.call("check_baseline_exists")

    if not baseline_check.get("exists", False):
      self._send_error("optimization_error", "No baseline initialized! Please ensure baseline is loaded before starting optimization.")
      return

    with anvil.server.no_loading_indicator:
      result = anvil.server.call("start_optimization")

    status = result.get("state")
    print(f"[INFO] Optimization status: {status}")

    if status == "started":
      print("[SUCCESS] Optimization started!")
      self._send_to_iframe("optimization_started", success=True)
      self.opt_running = True
      self._reset_indexes()

    elif status == "busy":
      self._send_to_iframe("optimization_started", success=False, message="Optimization already running")

    elif status in ("no_baseline", "baseline_error"):
      self._send_error("optimization_error", result.get("reason") or result.get("error", "Baseline error"))
      self.opt_running = False
      self._reset_indexes()

    else:
      technical_error = result.get("error") or result.get("reason", "Unknown error") if isinstance(result, dict) else "No response from backend"
      self._send_error("optimization_error", technical_error)
      self.opt_running = False
      self._reset_indexes()

  def poll_optimization_data(self, **event_args):
    with anvil.server.no_loading_indicator:
      result = anvil.server.call("get_live_optimization", self.last_action_idx, self.last_rsrp_idx, self.last_compliance_idx)

    new_actions = result.get("new_action_configs", [])
    new_bsrv_rsrp = result.get("new_bsrv_rsrp", [])
    new_compliance = result.get("new_compliance", [])
    status = result.get("state", "idle")
    message = result.get("message", "")

    def _update_indexes():
      self.last_action_idx = result.get("last_action_idx", self.last_action_idx)
      self.last_rsrp_idx = result.get("last_rsrp_idx", self.last_rsrp_idx)
      self.last_compliance_idx = result.get("last_compliance_idx", self.last_compliance_idx)

    if status == "error":
      self.opt_running = False
      self._reset_indexes()
      self._send_error("optimization_error", message or "Optimization failed")
      return

    if status == "finished":
      if new_actions or new_bsrv_rsrp or new_compliance:
        print(f"[DEBUG] Sending final batch: {len(new_actions)} action(s), {len(new_bsrv_rsrp)} rsrp, {len(new_compliance)} compliance")
        print("[BACK] compliance: ", new_compliance)
      self._send_to_iframe("optimization_update", new_action_configs=new_actions, new_bsrv_rsrp=new_bsrv_rsrp, new_compliance=new_compliance, status=status, message=message, rsrp_send_timestamp_sec=result.get("rsrp_send_timestamp_sec"))
      _update_indexes()
      print(f"[+] OPTIMIZATION COMPLETED — actions={self.last_action_idx}, rsrp={self.last_rsrp_idx}, compliance={self.last_compliance_idx}")
      self._send_to_iframe("optimization_finished", success=True)
      self.opt_running = False
      self._reset_indexes()
      return

    if status == "idle":
      self.opt_running = False
      self._reset_indexes()
      print("[!] Optimization is idle")
      return

    if new_actions or new_bsrv_rsrp or new_compliance:
      print(f"[DEBUG] Sending {len(new_actions)} action(s), {len(new_bsrv_rsrp)} rsrp, {len(new_compliance)} compliance to HTML display")

    self._send_to_iframe("optimization_update", new_action_configs=new_actions, new_bsrv_rsrp=new_bsrv_rsrp, new_compliance=new_compliance, status=status, message=message, rsrp_send_timestamp_sec=result.get("rsrp_send_timestamp_sec"))
    _update_indexes()

    # ========== DXF ==========
  def generate_dxf(self, event):
    print("Iframe sent DXF generation request...")
    request_id = event.detail.get("requestId") if hasattr(event, "detail") else None
    data = event.detail
    image_base64 = data.get("image")
    params = data.get("params")

    if not image_base64:
      self._send_error("dxf_error", "No image provided for DXF generation", request_id=request_id)
      return

    with anvil.server.no_loading_indicator:
      dxf_media = anvil.server.call("generate_dxf_from_floorplan", image_base64, params)

    if not dxf_media:
      self._send_error("dxf_error", "Backend failed to generate DXF", request_id=request_id)
      return

    self._send_to_iframe("dxf_generated", requestId=request_id, fileName=dxf_media.name or "floorplan.dxf")
    from anvil.media import download
    download(dxf_media)

  def parse_dxf(self, event):
    print("Iframe sent DXF parsing request...")
    request_id = event.detail.get("requestId") if hasattr(event, "detail") else None
    data = event.detail
    file_content = data.get("content")
    filename = data.get("filename", "floorplan.dxf")

    if not file_content:
      self._send_error("dxf_parsed_response", "No file content provided for DXF parsing", request_id=request_id)
      return

    if "," in file_content:
      _, encoded = file_content.split(",", 1)
      decoded = base64.b64decode(encoded)
    else:
      decoded = base64.b64decode(file_content)

    dxf_media = anvil.BlobMedia("application/dxf", decoded, filename)

    with anvil.server.no_loading_indicator:
      project_data = anvil.server.call("parse_dxf_file", dxf_media)

    if not project_data:
      self._send_error("dxf_parsed_response", "Backend failed to parse DXF", request_id=request_id)
      return

    self._send_to_iframe("dxf_parsed_response", success=True, requestId=request_id, data=project_data)


    # ========== Compliance ==========
  def update_compliance_settings(self, event):
    request_id = event.detail.get("requestId") if hasattr(event, "detail") else None
    data = event.detail
    threshold = data.get("complianceThreshold")
    percentage = data.get("compliancePercentage")

    with anvil.server.no_loading_indicator:
      result = anvil.server.call("set_compliance_settings", threshold, percentage)

    if result.get("status") != "success":
      self._send_error("compliance_settings_response", result.get("message", "Unknown error"), request_id=request_id)
      return

    self._send_to_iframe("compliance_settings_response", success=True, requestId=request_id, threshold=result.get("threshold"), percentage=result.get("percentage"))

    # ========== App Version ==========
  def send_app_version(self, event=None):
    retries = 10
    while retries > 0:
      try:
        with anvil.server.no_loading_indicator:
          version = anvil.server.call("get_app_version")
        self._send_to_iframe("app_version", version=version)
        break
      except Exception as e:
        print(f"Waiting for backend connection to get app version... ({retries} attempts left)")
        time.sleep(1)
        retries -= 1

    # ========== Session ==========
  def _reset_indexes(self):
    self.last_action_idx = 0
    self.last_rsrp_idx = 0
    self.last_compliance_idx = 0

  def reset_session(self, event=None):
    self.opt_running = False
    self.enable_live_rsrp = False
    self._pending_rsrp_ant_id = None
    self._pending_rsrp_timestamp = None
    self._reset_indexes()
    print("Resetting backend session...")
    while True:
      try:
        with anvil.server.no_loading_indicator:
          anvil.server.call("reset_session")
        break
      except:
        print(".", end="")
        time.sleep(1)
