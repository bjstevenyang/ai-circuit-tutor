// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App';
import { STORAGE_KEY } from '../storage';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('student-facing editor feedback', () => {
  it.each(['Delete', 'Backspace'])('deletes a selected component with %s and supports undo', key => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '放置元件' }));
    const part = screen.getByRole('button', { name: '电阻 330 欧姆，锚点 a10' });
    fireEvent.click(part);
    fireEvent.keyDown(part, { key });
    expect(screen.queryByRole('button', { name: '电阻 330 欧姆，锚点 a10' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').components).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(screen.getByRole('button', { name: '电阻 330 欧姆，锚点 a10' })).toBeInTheDocument();
  });

  it('offers a visible delete button beside the run controls', () => {
    render(<App />);
    const toolbar = within(screen.getByRole('toolbar', { name: '电路编辑操作' }));
    expect(toolbar.getByRole('button', { name: '删除' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '放置元件' }));
    expect(toolbar.getByRole('button', { name: '删除' })).toBeEnabled();
    fireEvent.click(toolbar.getByRole('button', { name: '删除' }));
    expect(screen.queryByRole('button', { name: '电阻 330 欧姆，锚点 a10' })).not.toBeInTheDocument();
  });

  it.each(['Delete', 'Backspace'])('preserves the selected component when %s edits a text field', key => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '放置元件' }));
    fireEvent.keyDown(screen.getByLabelText('所选元件新锚点'), { key });
    expect(screen.getByRole('button', { name: '电阻 330 欧姆，锚点 a10' })).toBeInTheDocument();
  });

  it('also deletes selected wires through the same shortcut', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('导线起点'), { target: { value: 'a1' } });
    fireEvent.change(screen.getByLabelText('导线终点'), { target: { value: 'a2' } });
    fireEvent.click(screen.getByRole('button', { name: '添加导线' }));
    const wire = screen.getByRole('button', { name: '导线 a1 到 a2' });
    fireEvent.click(wire);
    fireEvent.keyDown(wire, { key: 'Delete' });
    expect(screen.queryByRole('button', { name: '导线 a1 到 a2' })).not.toBeInTheDocument();
  });

  it('reports the selected conductive group through the non-drag inspector', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('查看孔位连接'), { target: { value: 'a1' } });
    fireEvent.click(screen.getByRole('button', { name: '查看' }));
    expect(screen.getByText('a1 所在网络包含 5 个孔位／端口')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '孔位 b1，空闲' })).toHaveClass('connected');
    expect(screen.getByRole('button', { name: '孔位 f1，空闲' })).not.toHaveClass('connected');
    expect(screen.getByRole('button', { name: '孔位 b1，空闲' })).toHaveAccessibleDescription('a1、b1、c1、d1、e1');
  });

  it('keeps invalid input available for correction and leaves the document untouched', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('锚点孔位'), { target: { value: 'a30' } });
    fireEvent.click(screen.getByRole('button', { name: '放置元件' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('锚点孔位')).toHaveValue('a30');
    expect(screen.getByRole('button', { name: '撤销' })).toBeDisabled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('protects malformed saved work from automatic overwrite during editing', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('原有作品尚未读取成功');
    fireEvent.click(screen.getByRole('button', { name: '放置元件' }));
    expect(screen.getByRole('button', { name: '电阻 330 欧姆，锚点 a10' })).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
  });

  it('does not claim an LED is off when the electrical state was not calculated', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '运行电路' }));
    expect(screen.getByText('未计算 LED 状态')).toBeInTheDocument();
    expect(screen.queryByText('LED 未点亮')).not.toBeInTheDocument();
  });

  it('leaves move mode and clears pending wiring when undoing a placement', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '放置元件' }));
    fireEvent.click(screen.getByRole('button', { name: '点选移动' }));
    fireEvent.change(screen.getByLabelText('导线起点'), { target: { value: 'a1' } });
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(screen.getByText('点击孔位，看看哪些孔真正相连')).toBeInTheDocument();
    expect(screen.getByLabelText('导线起点')).toHaveValue('');
    expect(screen.getByRole('button', { name: '重做' })).toBeEnabled();
  });
});
