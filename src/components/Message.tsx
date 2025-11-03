import React from 'react';
import './Message.css';

interface MessageProps {
  text: string;
  type: 'success' | 'error';
}

export const Message: React.FC<MessageProps> = ({ text, type }) => {
  return (
    <div className={`message ${type}`}>
      {text}
    </div>
  );
};