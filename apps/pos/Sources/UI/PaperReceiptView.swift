import SwiftUI

struct SawtoothEdge: Shape {
    var toothWidth: CGFloat = 10
    var toothHeight: CGFloat = 6

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: 0, y: toothHeight))
        var x: CGFloat = 0
        var up = true
        while x < rect.width {
            let next = min(x + toothWidth, rect.width)
            let y: CGFloat = up ? 0 : toothHeight
            path.addLine(to: CGPoint(x: next, y: y))
            x = next
            up.toggle()
        }
        path.addLine(to: CGPoint(x: rect.width, y: rect.height))
        path.addLine(to: CGPoint(x: 0, y: rect.height))
        path.closeSubpath()
        return path
    }
}

struct PaperReceiptView<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            SawtoothEdge()
                .fill(PosDesign.paper)
                .frame(height: 8)
                .rotationEffect(.degrees(180))
            content()
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(PosDesign.paper)
            SawtoothEdge()
                .fill(PosDesign.paper)
                .frame(height: 8)
        }
        .foregroundStyle(PosDesign.ink)
        .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
    }
}

#if DEBUG
#Preview {
    ZStack {
        PosDesign.bg.ignoresSafeArea()
        PaperReceiptView {
            Text("Demo-Bon").font(PosDesign.fontDisplay)
            Text("Tisch 12 · Gang 2")
                .font(PosDesign.fontBody)
                .foregroundStyle(PosDesign.muted)
            Text("12,50 €").font(PosDesign.fontMonoTabular)
        }
        .padding()
    }
}
#endif
