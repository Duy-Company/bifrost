import AppKit
let root = CommandLine.arguments[1]
let size = 1024
let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()
let bg = NSBezierPath(roundedRect: NSRect(x: 56, y: 56, width: 912, height: 912), xRadius: 204, yRadius: 204)
let shadow = NSShadow(); shadow.shadowOffset = NSSize(width: 0, height: -13); shadow.shadowBlurRadius = 24; shadow.shadowColor = NSColor(calibratedRed: 0.2, green: 0.5, blue: 0.65, alpha: 0.16)
NSGraphicsContext.saveGraphicsState(); shadow.set(); NSColor.white.setFill(); bg.fill(); NSGraphicsContext.restoreGraphicsState()
let gradient = NSGradient(starting: NSColor(calibratedRed: 1, green: 1, blue: 1, alpha: 1), ending: NSColor(calibratedRed: 0.9, green: 0.97, blue: 1, alpha: 1))!
gradient.draw(in: bg, angle: -65)
func point(_ x: Double, _ y: Double) -> NSPoint { NSPoint(x: 155 + x * 4, y: 940 - y * 4) }
func path(_ pts: [(Double, Double)]) -> NSBezierPath { let p = NSBezierPath(); p.move(to: point(pts[0].0, pts[0].1)); for pt in pts.dropFirst() { p.line(to: point(pt.0, pt.1)) }; p.close(); return p }
let bolt = path([(101,9),(32,119),(80,119),(71,211),(149,85),(97,85),(121,9)])
let boltShadow = NSShadow(); boltShadow.shadowOffset = NSSize(width: 2, height: -20); boltShadow.shadowBlurRadius = 26; boltShadow.shadowColor = NSColor(calibratedRed: 0.1, green: 0.65, blue: 0.9, alpha: 0.22)
NSGraphicsContext.saveGraphicsState(); boltShadow.set(); NSColor.white.setFill(); bolt.fill(); NSGraphicsContext.restoreGraphicsState()
NSGradient(colors: [NSColor(calibratedRed: 0.89, green: 0.99, blue: 1, alpha: 1),NSColor(calibratedRed: 0.43, green: 0.82, blue: 0.98, alpha: 1),NSColor(calibratedRed: 0.1, green: 0.61, blue: 0.87, alpha: 1)])!.draw(in: bolt, angle: -65)
NSColor(calibratedRed: 1, green: 1, blue: 1, alpha: 0.5).setFill(); path([(101,9),(54,108),(97,85),(121,9)]).fill()
NSColor(calibratedRed: 0.78, green: 0.98, blue: 1, alpha: 0.8).setFill(); path([(32,119),(97,85),(80,119)]).fill()
NSColor(calibratedRed: 0.11, green: 0.56, blue: 0.83, alpha: 0.23).setFill(); path([(80,119),(97,85),(149,85),(71,211),(108,112)]).fill()
NSColor(calibratedRed: 1, green: 1, blue: 1, alpha: 0.65).setFill(); path([(97,85),(108,112),(149,85)]).fill()
let edge = NSBezierPath(); edge.move(to:point(101,9)); edge.line(to:point(97,85)); edge.line(to:point(108,112)); edge.line(to:point(71,211)); edge.lineWidth = 3; NSColor.white.withAlphaComponent(0.65).setStroke(); edge.stroke()
image.unlockFocus()
let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: root + "/resources/icon.png"))
