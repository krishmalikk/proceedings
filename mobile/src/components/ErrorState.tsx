import React from 'react';
import { ViewStyle } from 'react-native';
import { EmptyState } from './EmptyState';

/**
 * ErrorState — shared "something went wrong" panel with retry
 * (design-system state primitive; composes EmptyState).
 *
 *   <ErrorState body={error} onRetry={reload} />
 */
export interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}

export function ErrorState({
  title = 'Something went wrong',
  body = 'Please check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  style,
}: ErrorStateProps) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={title}
      body={body}
      actionLabel={onRetry ? retryLabel : undefined}
      onAction={onRetry}
      style={style}
    />
  );
}

export default ErrorState;
