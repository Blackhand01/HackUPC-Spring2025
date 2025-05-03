// src/components/functional/CopyToClipboard.tsx
'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Clipboard, Check } from 'lucide-react';

interface CopyToClipboardProps {
  textToCopy: string;
  children: React.ReactNode; // Expecting a button or trigger element
  toastMessage?: string;
}

export const CopyToClipboard: React.FC<CopyToClipboardProps> = ({
  textToCopy,
  children,
  toastMessage = 'Copied to clipboard!',
}) => {
  const { toast } = useToast();
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      toast({
        title: 'Copied!',
        description: toastMessage,
      });
      // Reset icon after a delay
      setTimeout(() => setIsCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Could not copy text to clipboard.',
      });
    }
  };

  // Enhance the child element with the onClick handler and potentially change icon
   const childElement = React.Children.only(children) as React.ReactElement<any>;

   const triggerElement = React.cloneElement(childElement, {
     onClick: (e: React.MouseEvent) => {
       handleCopy();
       // Call original onClick if it exists
       childElement.props.onClick?.(e);
     },
     // Optionally replace icon if the child is a Button with an icon prop
     // This depends on the structure of the child Button component
     children: React.Children.map(childElement.props.children, child => {
        // Attempt to replace icon if it's a Lucide icon
        if (React.isValidElement(child) && typeof child.type !== 'string' && (child.type === Clipboard || child.type === Check)) {
            return isCopied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />;
        }
        return child;
     })
   });


  return triggerElement;
};

    