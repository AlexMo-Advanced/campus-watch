import React, { useState } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import DraggableWidget from './DraggableWidget';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 16; // Outer padding
const NUM_COLS = 12;
const COL_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2) / NUM_COLS;
const ROW_HEIGHT = COL_WIDTH;

export default function WidgetGrid({ layout, isEditing, onLayoutChange, onRemove }) {
  
  // Calculate total height of grid based on widgets
  const maxRow = layout.reduce((max, item) => Math.max(max, item.grid_y + item.height), 0);
  // Add some buffer at the bottom for dragging, or if empty (only when editing)
  const gridHeight = Math.max(maxRow + (isEditing ? 2 : 0), isEditing ? 4 : 0) * ROW_HEIGHT;

  const handleDragEnd = (id, newX, newY) => {
    onLayoutChange(id, { grid_x: newX, grid_y: newY });
  };

  const handleResizeEnd = (id, newW, newH) => {
    onLayoutChange(id, { width: newW, height: newH });
  };

  if (layout.length === 0 && !isEditing) {
    return null;
  }

  return (
    <View style={[styles.gridContainer, { height: gridHeight }]}>
      {layout.map((item) => (
        <DraggableWidget
          key={item.id}
          item={item}
          colWidth={COL_WIDTH}
          rowHeight={ROW_HEIGHT}
          isEditing={isEditing}
          onDragEnd={handleDragEnd}
          onResizeEnd={handleResizeEnd}
          onRemove={onRemove}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    width: '100%',
    position: 'relative',
    marginTop: 16,
    paddingHorizontal: GRID_PADDING
  }
});
