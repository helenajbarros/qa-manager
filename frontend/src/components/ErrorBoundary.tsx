import { Component, ReactNode } from "react";

// Error boundary to catch runtime crashes and show a message instead of white screen
export class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean; error: string}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, error: err?.message || String(err) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{height:"100vh",display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",background:"#F8F9FB",
          gap:16,fontFamily:"system-ui,sans-serif",padding:24,textAlign:"center"}}>
          <div style={{fontSize:48}}>⚠️</div>
          <h2 style={{fontSize:18,fontWeight:700,color:"#111"}}>Algo deu errado</h2>
          <p style={{fontSize:13,color:"#6B7280",maxWidth:400}}>{this.state.error}</p>
          <button onClick={()=>window.location.reload()}
            style={{padding:"8px 20px",background:"#2563EB",color:"#fff",border:"none",
              borderRadius:8,cursor:"pointer",fontSize:14}}>
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
