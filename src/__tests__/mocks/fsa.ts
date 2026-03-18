/**
 * Mock File System Access API for testing fs.ts
 */

export class MockFile {
  name: string;
  lastModified: number;
  private content: string;

  constructor(name: string, content: string = '', lastModified: number = Date.now()) {
    this.name = name;
    this.content = content;
    this.lastModified = lastModified;
  }

  text(): Promise<string> {
    return Promise.resolve(this.content);
  }
}

export class MockWritableFileStream {
  private chunks: string[] = [];
  closed = false;

  write(data: string | Blob): Promise<void> {
    this.chunks.push(typeof data === 'string' ? data : '[blob]');
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }

  getWrittenContent(): string {
    return this.chunks.join('');
  }
}

export class MockFileHandle {
  kind = 'file' as const;
  name: string;
  private file: MockFile;
  lastWritable: MockWritableFileStream | null = null;

  constructor(name: string, content: string = '', lastModified?: number) {
    this.name = name;
    this.file = new MockFile(name, content, lastModified);
  }

  getFile(): Promise<MockFile> {
    return Promise.resolve(this.file);
  }

  createWritable(): Promise<MockWritableFileStream> {
    const writable = new MockWritableFileStream();
    const fileHandle = this;
    const originalClose = writable.close.bind(writable);
    writable.close = async () => {
      await originalClose();
      fileHandle.updateContent(writable.getWrittenContent());
    };
    this.lastWritable = writable;
    return Promise.resolve(writable);
  }

  updateContent(content: string): void {
    this.file = new MockFile(this.name, content);
  }
}

export class MockDirectoryHandle {
  kind = 'directory' as const;
  name: string;
  private files: Map<string, MockFileHandle> = new Map();
  private dirs: Map<string, MockDirectoryHandle> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  addFile(name: string, content: string = '', lastModified?: number): MockFileHandle {
    const handle = new MockFileHandle(name, content, lastModified);
    this.files.set(name, handle);
    return handle;
  }

  addDirectory(name: string): MockDirectoryHandle {
    const handle = new MockDirectoryHandle(name);
    this.dirs.set(name, handle);
    return handle;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<MockFileHandle> {
    if (this.files.has(name)) return this.files.get(name)!;
    if (options?.create) {
      const handle = new MockFileHandle(name);
      this.files.set(name, handle);
      return handle;
    }
    throw new DOMException('File not found: ' + name, 'NotFoundError');
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MockDirectoryHandle> {
    if (this.dirs.has(name)) return this.dirs.get(name)!;
    if (options?.create) {
      const handle = new MockDirectoryHandle(name);
      this.dirs.set(name, handle);
      return handle;
    }
    throw new DOMException('Directory not found: ' + name, 'NotFoundError');
  }

  async removeEntry(name: string): Promise<void> {
    this.files.delete(name);
    this.dirs.delete(name);
  }

  async queryPermission(): Promise<string> {
    return 'granted';
  }

  async requestPermission(): Promise<string> {
    return 'granted';
  }

  async *entries(): AsyncGenerator<[string, MockFileHandle | MockDirectoryHandle]> {
    for (const [name, handle] of this.files) {
      yield [name, handle];
    }
    for (const [name, handle] of this.dirs) {
      yield [name, handle];
    }
  }
}
