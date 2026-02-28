declare module 'react-window' {
  import * as React from 'react';

  export type ListOnItemsRenderedProps = {
    overscanStartIndex: number;
    overscanStopIndex: number;
    visibleStartIndex: number;
    visibleStopIndex: number;
  };

  export type ListChildComponentProps = {
    index: number;
    style: React.CSSProperties;
    isScrolling?: boolean;
    data?: any;
  };

  export interface FixedSizeListProps {
    children: React.ComponentType<ListChildComponentProps>;
    className?: string;
    height: number;
    itemCount: number;
    itemData?: any;
    itemKey?: (index: number, data?: any) => React.Key;
    itemSize: number;
    onItemsRendered?: (props: ListOnItemsRenderedProps) => void;
    outerRef?: React.Ref<any>;
    overscanCount?: number;
    style?: React.CSSProperties;
    width: number | string;
  }

  export class FixedSizeList extends React.PureComponent<FixedSizeListProps> {}
}
