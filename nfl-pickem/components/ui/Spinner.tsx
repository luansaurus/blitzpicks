import { Loader2, LucideProps } from 'lucide-react';

export default function Spinner(props: LucideProps) {
  return <Loader2 className={`animate-spin ${props.className || ''}`} size={props.size || 24} {...props} />;
}