import Cocoa
import ApplicationServices

// Only the selected cell's rectangle in the frontmost Numbers window is read.
// No cell values, screenshots, keyboard input, or other applications are inspected.
func emit(_ object: [String: Any]) {
 if let bytes = try? JSONSerialization.data(withJSONObject: object), let text = String(data: bytes, encoding: .utf8) { print(text) }
}
func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
 var value: CFTypeRef?
 guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
 return value
}
func rectangle(_ cell: AXUIElement) -> [String: Any]? {
 guard let role = attribute(cell, kAXRoleAttribute) as? String, role == kAXCellRole || role == kAXTextFieldRole else { return nil }
 guard let p = attribute(cell, kAXPositionAttribute), let s = attribute(cell, kAXSizeAttribute), CFGetTypeID(p) == AXValueGetTypeID(), CFGetTypeID(s) == AXValueGetTypeID() else { return nil }
 var point = CGPoint.zero, size = CGSize.zero
 guard AXValueGetValue(unsafeBitCast(p, to: AXValue.self), .cgPoint, &point), AXValueGetValue(unsafeBitCast(s, to: AXValue.self), .cgSize, &size), size.width > 0, size.height > 0 else { return nil }
 return ["status":"anchor", "x":point.x,"y":point.y,"width":size.width,"height":size.height]
}
if !AXIsProcessTrusted() { emit(["status":"accessibility"]); exit(0) }
guard let app = NSWorkspace.shared.frontmostApplication, let identifier = app.bundleIdentifier, ["com.apple.Numbers","com.apple.iWork.Numbers"].contains(identifier) else { emit(["status":"unavailable"]); exit(0) }
let root = AXUIElementCreateApplication(app.processIdentifier)
var queue: [AXUIElement] = [root]
var visited = 0
while !queue.isEmpty && visited < 2500 {
 let element = queue.removeFirst(); visited += 1
 if let selected = attribute(element, "AXSelectedCells") as? [AXUIElement], selected.count == 1, let rect = rectangle(selected[0]) { emit(rect); exit(0) }
 if attribute(element, kAXRoleAttribute) as? String == kAXCellRole, attribute(element, kAXSelectedAttribute) as? Bool == true, let rect = rectangle(element) { emit(rect); exit(0) }
 if let children = attribute(element, kAXChildrenAttribute) as? [AXUIElement] { queue.append(contentsOf: children.prefix(2500 - visited)) }
}
emit(["status":"unavailable"])
