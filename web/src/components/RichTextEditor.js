import React, { useRef, useEffect, forwardRef } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { 
  BoldOutlined, 
  ItalicOutlined, 
  UnderlineOutlined, 
  LinkOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined
} from '@ant-design/icons';

const RichTextEditor = forwardRef(({ value, onChange, placeholder = "Введите текст..." }, ref) => {
  const editorRef = useRef(null);
  
  // Передаем ref в editorRef
  React.useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current?.innerHTML || '',
    setValue: (val) => {
      if (editorRef.current) {
        editorRef.current.innerHTML = val || '';
      }
    }
  }));

  useEffect(() => {
    if (editorRef.current) {
      const currentValue = value || '';
      if (editorRef.current.innerHTML !== currentValue) {
        editorRef.current.innerHTML = currentValue;
      }
    }
  }, [value]);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current.focus();
    handleChange();
  };

  const handleChange = () => {
    if (onChange) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const insertLink = () => {
    const url = prompt('Введите URL ссылки:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const insertList = (ordered = false) => {
    if (ordered) {
      execCommand('insertOrderedList');
    } else {
      execCommand('insertUnorderedList');
    }
  };

  const alignText = (alignment) => {
    if (editorRef.current) {
      // Устанавливаем text-align через CSS
      editorRef.current.style.textAlign = alignment.toLowerCase();
      
      // Также устанавливаем для всех дочерних элементов
      const allElements = editorRef.current.querySelectorAll('*');
      allElements.forEach(element => {
        element.style.textAlign = alignment.toLowerCase();
      });
      
      editorRef.current.focus();
      handleChange();
    }
  };

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px' }}>
      {/* Панель инструментов */}
      <div 
        className="rich-text-editor-toolbar"
        style={{ 
          borderBottom: '1px solid #d9d9d9', 
          padding: '8px 12px', 
          background: '#fafafa',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px'
        }}
      >
        <Space size="small" wrap>
          <Tooltip title="Жирный">
            <Button 
              size="small" 
              icon={<BoldOutlined />} 
              onClick={() => execCommand('bold')}
            />
          </Tooltip>
          
          <Tooltip title="Курсив">
            <Button 
              size="small" 
              icon={<ItalicOutlined />} 
              onClick={() => execCommand('italic')}
            />
          </Tooltip>
          
          <Tooltip title="Подчеркнутый">
            <Button 
              size="small" 
              icon={<UnderlineOutlined />} 
              onClick={() => execCommand('underline')}
            />
          </Tooltip>
          
          <Tooltip title="Добавить ссылку">
            <Button 
              size="small" 
              icon={<LinkOutlined />} 
              onClick={insertLink}
            />
          </Tooltip>
          
          <Tooltip title="Маркированный список">
            <Button 
              size="small" 
              icon={<UnorderedListOutlined />} 
              onClick={() => insertList(false)}
            />
          </Tooltip>
          
          <Tooltip title="Нумерованный список">
            <Button 
              size="small" 
              icon={<OrderedListOutlined />} 
              onClick={() => insertList(true)}
            />
          </Tooltip>
          
          <Tooltip title="Выровнять по левому краю">
            <Button 
              size="small" 
              icon={<AlignLeftOutlined />} 
              onClick={() => alignText('Left')}
            />
          </Tooltip>
          
          <Tooltip title="Выровнять по центру">
            <Button 
              size="small" 
              icon={<AlignCenterOutlined />} 
              onClick={() => alignText('Center')}
            />
          </Tooltip>
          
          <Tooltip title="Выровнять по правому краю">
            <Button 
              size="small" 
              icon={<AlignRightOutlined />} 
              onClick={() => alignText('Right')}
            />
          </Tooltip>
        </Space>
      </div>
      
      {/* Область редактирования */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleChange}
        onBlur={handleChange}
        
        style={{
          minHeight: '200px',
          padding: '12px',
          outline: 'none',
          fontSize: '14px',
          lineHeight: '1.5',
          fontFamily: 'inherit',
          direction: 'ltr',
          textAlign: 'left'
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
        dir="ltr"
      />
      
      <style>{`
        [contenteditable] {
          direction: ltr !important;
          text-align: left !important;
        }
        [contenteditable] * {
          direction: ltr !important;
          text-align: left !important;
        }
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #8c8c8c;
          font-style: italic;
        }
        [data-theme="dark"] [contenteditable]:empty:before {
          color: #ffffff;
        }
        [data-theme="dark"] .ant-btn {
          color: #ffffff;
          background: #1f1f1f;
          border-color: #303030;
        }
        [data-theme="dark"] .ant-btn:hover {
          color: #1890ff;
          background: #1f1f1f;
          border-color: #1890ff;
        }
        [data-theme="dark"] .ant-tooltip .ant-tooltip-inner {
          background: #1f1f1f;
          color: #ffffff;
        }
        [data-theme="dark"] .ant-tooltip .ant-tooltip-arrow::before {
          background: #1f1f1f;
        }
        [data-theme="dark"] [contenteditable] {
          background: #1f1f1f !important;
          color: #ffffff !important;
          border-color: #303030 !important;
          direction: ltr !important;
          text-align: left !important;
        }
        [data-theme="dark"] [contenteditable] * {
          direction: ltr !important;
          text-align: left !important;
        }
        [data-theme="dark"] [contenteditable]:focus {
          border-color: #1890ff !important;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2) !important;
        }
        [data-theme="dark"] .rich-text-editor-toolbar {
          background: #1f1f1f !important;
          border-color: #303030 !important;
        }
      `}</style>
    </div>
  );
});

export default RichTextEditor;
