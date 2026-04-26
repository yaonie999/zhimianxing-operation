import React from 'react'

export default function Drawer({ title, open, onClose, children, width = 400 }) {
  if (!open) return null

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        className="drawer-content"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <h3>{title}</h3>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </div>
      <style>{`
        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.4);
          z-index: 1000;
        }
        .drawer-content {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          background: #fff;
          box-shadow: -2px 0 10px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
        }
        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }
        .drawer-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }
        .drawer-close {
          width: 32px;
          height: 32px;
          border: none;
          background: none;
          font-size: 24px;
          color: #6b7280;
          cursor: pointer;
          border-radius: 4px;
        }
        .drawer-close:hover {
          background: #e5e7eb;
          color: #1f2937;
        }
        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
      `}</style>
    </div>
  )
}
